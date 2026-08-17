from nasaq.review_approvals import ReviewApprovalsStore
from nasaq.review_state import apply_persisted_approvals


def test_save_and_restore_ready_approval(tmp_path):
    store = ReviewApprovalsStore(str(tmp_path / "review-approvals.json"))
    store.save_ready(
        review_id="review-abc",
        absolute_path="/work/report.pdf",
        root_path="/work",
        topic="مشروع أ",
        document_type="تقرير",
        version_status="نهائي",
        accepted_full_name="مشروع أ - تقرير - نهائي.pdf",
        known_absolute_paths=["/work/report.pdf"],
    )

    rows = [
        {
            "absolutePath": "/work/report.pdf",
            "currentName": "report",
            "extension": ".pdf",
            "topic": "proposal",
            "documentType": "doc",
            "versionStatus": "",
        }
    ]

    merged = apply_persisted_approvals(store, "/work", rows)
    assert merged[0]["reviewId"] == "review-abc"
    assert merged[0]["reviewStatus"] == "ready"
    assert merged[0]["acceptedTopic"] == "مشروع أ"


def test_restore_complete_when_disk_matches_accepted_name(tmp_path):
    store = ReviewApprovalsStore(str(tmp_path / "review-approvals.json"))
    store.save_ready(
        review_id="review-abc",
        absolute_path="/work/مشروع أ - تقرير - نهائي.pdf",
        root_path="/work",
        topic="مشروع أ",
        document_type="تقرير",
        version_status="نهائي",
        accepted_full_name="مشروع أ - تقرير - نهائي.pdf",
    )

    rows = [
        {
            "absolutePath": "/work/مشروع أ - تقرير - نهائي.pdf",
            "currentName": "مشروع أ - تقرير - نهائي",
            "extension": ".pdf",
        }
    ]

    merged = apply_persisted_approvals(store, "/work", rows)
    assert merged[0]["reviewStatus"] == "complete"


def test_lookup_by_prior_absolute_path_after_rename(tmp_path):
    store = ReviewApprovalsStore(str(tmp_path / "review-approvals.json"))
    store.save_ready(
        review_id="review-abc",
        absolute_path="/work/old-name.pdf",
        root_path="/work",
        topic="مشروع أ",
        document_type="تقرير",
        version_status="نهائي",
        accepted_full_name="مشروع أ - تقرير - نهائي.pdf",
        known_absolute_paths=["/work/old-name.pdf", "/work/مشروع أ - تقرير - نهائي.pdf"],
    )

    rows = [
        {
            "absolutePath": "/work/مشروع أ - تقرير - نهائي.pdf",
            "currentName": "مشروع أ - تقرير - نهائي",
            "extension": ".pdf",
        }
    ]

    merged = apply_persisted_approvals(store, "/work", rows)
    assert merged[0]["reviewId"] == "review-abc"
    assert merged[0]["reviewStatus"] == "complete"
