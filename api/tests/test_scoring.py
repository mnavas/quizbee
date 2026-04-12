"""
Integration tests for the scoring engine and session submission flow.

These tests hit the real FastAPI app against a live PostgreSQL test database,
exercising the full stack: router → model → scoring → DB.
"""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


# ── Helpers ───────────────────────────────────────────────────────────────────

async def create_question(client: AsyncClient, token: str, **kwargs) -> dict:
    payload = {
        "type": "multiple_choice",
        "prompt_json": {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Q"}]}]},
        "points": 1,
        "tags": [],
        **kwargs,
    }
    resp = await client.post("/api/v1/questions", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201, resp.text
    return resp.json()


async def create_and_publish_test(client: AsyncClient, token: str, blocks: list) -> dict:
    resp = await client.post("/api/v1/tests", json={"title": "Test", "blocks": blocks}, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201, resp.text
    test = resp.json()
    pub = await client.post(f"/api/v1/tests/{test['id']}/publish", headers={"Authorization": f"Bearer {token}"})
    assert pub.status_code == 200, pub.text
    return pub.json()


# ── Tests ─────────────────────────────────────────────────────────────────────

async def test_multiple_choice_correct_scores_full_points(client: AsyncClient, admin_token: str):
    """Selecting the correct option awards full points."""
    q = await create_question(client, admin_token,
        type="multiple_choice",
        options=[{"id": "a", "text": "Paris"}, {"id": "b", "text": "London"}],
        correct_answer={"value": "a"},
        points=2,
    )
    test = await create_and_publish_test(client, admin_token, blocks=[{
        "title": None, "context_json": None, "order": 0,
        "questions": [{"question_id": q["id"], "order": 0}],
    }])

    session = (await client.post(f"/api/v1/sessions/take/{test['link_token']}", json={})).json()
    sid = session["id"]
    qid = session["questions"][0]["id"]

    await client.put(f"/api/v1/sessions/{sid}/answers/{qid}", json={"value": {"selected": "a"}})
    result = (await client.post(f"/api/v1/sessions/{sid}/submit")).json()

    assert result["status"] == "submitted"
    assert result["score_pct"] == 100
    assert result["passed"] is None  # no passing_score_pct set


async def test_multiple_choice_wrong_scores_zero(client: AsyncClient, admin_token: str):
    """Selecting the wrong option scores zero."""
    q = await create_question(client, admin_token,
        type="multiple_choice",
        options=[{"id": "a", "text": "Paris"}, {"id": "b", "text": "London"}],
        correct_answer={"value": "a"},
        points=1,
    )
    test = await create_and_publish_test(client, admin_token, blocks=[{
        "title": None, "context_json": None, "order": 0,
        "questions": [{"question_id": q["id"], "order": 0}],
    }])

    session = (await client.post(f"/api/v1/sessions/take/{test['link_token']}", json={})).json()
    sid = session["id"]
    qid = session["questions"][0]["id"]

    await client.put(f"/api/v1/sessions/{sid}/answers/{qid}", json={"value": {"selected": "b"}})
    result = (await client.post(f"/api/v1/sessions/{sid}/submit")).json()

    assert result["score_pct"] == 0


async def test_short_text_autoscored_case_insensitive(client: AsyncClient, admin_token: str):
    """Short-text answer is auto-scored case-insensitively."""
    q = await create_question(client, admin_token,
        type="short_text",
        correct_answer={"text": "necessary"},
        points=1,
    )
    test = await create_and_publish_test(client, admin_token, blocks=[{
        "title": None, "context_json": None, "order": 0,
        "questions": [{"question_id": q["id"], "order": 0}],
    }])

    session = (await client.post(f"/api/v1/sessions/take/{test['link_token']}", json={})).json()
    sid = session["id"]
    qid = session["questions"][0]["id"]

    await client.put(f"/api/v1/sessions/{sid}/answers/{qid}", json={"value": {"text": "Necessary"}})
    result = (await client.post(f"/api/v1/sessions/{sid}/submit")).json()

    assert result["score_pct"] == 100


async def test_multiple_select_all_or_nothing(client: AsyncClient, admin_token: str):
    """Multiple-select with all_or_nothing: partial selection scores zero."""
    q = await create_question(client, admin_token,
        type="multiple_select",
        options=[{"id": "a", "text": "A"}, {"id": "b", "text": "B"}, {"id": "c", "text": "C"}],
        correct_answer={"values": ["a", "b"]},
        points=2,
    )
    test = await create_and_publish_test(client, admin_token, blocks=[{
        "title": None, "context_json": None, "order": 0,
        "questions": [{"question_id": q["id"], "order": 0}],
    }])

    session = (await client.post(f"/api/v1/sessions/take/{test['link_token']}", json={})).json()
    sid = session["id"]
    qid = session["questions"][0]["id"]

    # Only select one of the two correct options
    await client.put(f"/api/v1/sessions/{sid}/answers/{qid}", json={"value": {"selected": ["a"]}})
    result = (await client.post(f"/api/v1/sessions/{sid}/submit")).json()

    assert result["score_pct"] == 0


async def test_multiple_select_partial_credit(client: AsyncClient, admin_token: str):
    """Multiple-select with partial scoring awards proportional points."""
    q = await create_question(client, admin_token,
        type="multiple_select",
        options=[{"id": "a", "text": "A"}, {"id": "b", "text": "B"}, {"id": "c", "text": "C"}],
        correct_answer={"values": ["a", "b"]},
        points=4,
    )
    # Create test with partial scoring enabled
    resp = await client.post("/api/v1/tests", json={
        "title": "Partial test",
        "multiple_select_scoring": "partial",
        "blocks": [{"title": None, "context_json": None, "order": 0,
                    "questions": [{"question_id": q["id"], "order": 0}]}],
    }, headers={"Authorization": f"Bearer {admin_token}"})
    test_id = resp.json()["id"]
    test = (await client.post(f"/api/v1/tests/{test_id}/publish", headers={"Authorization": f"Bearer {admin_token}"})).json()

    session = (await client.post(f"/api/v1/sessions/take/{test['link_token']}", json={})).json()
    sid = session["id"]
    qid = session["questions"][0]["id"]

    # Select 1 of 2 correct → should earn floor(1/2 * 4) = 2 points
    await client.put(f"/api/v1/sessions/{sid}/answers/{qid}", json={"value": {"selected": ["a"]}})
    result = (await client.post(f"/api/v1/sessions/{sid}/submit")).json()

    assert result["score_pct"] == 50


async def test_time_window_rejects_before_open(client: AsyncClient, admin_token: str):
    """Session start is rejected when current time is before available_from."""
    from datetime import datetime, timedelta, timezone
    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()

    q = await create_question(client, admin_token, type="true_false",
        correct_answer={"value": "true"}, points=1)
    resp = await client.post("/api/v1/tests", json={
        "title": "Future test",
        "available_from": future,
        "blocks": [{"title": None, "context_json": None, "order": 0,
                    "questions": [{"question_id": q["id"], "order": 0}]}],
    }, headers={"Authorization": f"Bearer {admin_token}"})
    test_id = resp.json()["id"]
    test = (await client.post(f"/api/v1/tests/{test_id}/publish", headers={"Authorization": f"Bearer {admin_token}"})).json()

    resp = await client.post(f"/api/v1/sessions/take/{test['link_token']}", json={})
    assert resp.status_code == 403
    assert "not available yet" in resp.json()["detail"]


async def test_session_submit_idempotent_guard(client: AsyncClient, admin_token: str):
    """Submitting an already-submitted session returns 400."""
    q = await create_question(client, admin_token, type="true_false",
        correct_answer={"value": "true"}, points=1)
    test = await create_and_publish_test(client, admin_token, blocks=[{
        "title": None, "context_json": None, "order": 0,
        "questions": [{"question_id": q["id"], "order": 0}],
    }])

    session = (await client.post(f"/api/v1/sessions/take/{test['link_token']}", json={})).json()
    sid = session["id"]

    await client.post(f"/api/v1/sessions/{sid}/submit")
    resp = await client.post(f"/api/v1/sessions/{sid}/submit")
    assert resp.status_code == 400
    assert "already submitted" in resp.json()["detail"]
