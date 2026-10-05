"""
Unit tests for the Medicine Expiry Tracker backend.
Run with: python -m pytest test_app.py -v
"""
import pytest
from datetime import date, timedelta
from app import calculate_status


def date_str(days_from_today):
    """Helper: returns a date string N days from today (negative = past)."""
    return (date.today() + timedelta(days=days_from_today)).strftime("%Y-%m-%d")


class TestCalculateStatus:
    """Tests for the core expiry-status calculation logic."""

    def test_safe_status_far_future(self):
        """A medicine expiring in 60 days should be Safe."""
        assert calculate_status(date_str(60)) == "Safe"

    def test_safe_status_boundary_31_days(self):
        """31 days remaining is just past the Expiring Soon threshold -> Safe."""
        assert calculate_status(date_str(31)) == "Safe"

    def test_expiring_soon_status(self):
        """A medicine expiring in 15 days should be Expiring Soon."""
        assert calculate_status(date_str(15)) == "Expiring Soon"

    def test_expiring_soon_boundary_30_days(self):
        """Exactly 30 days remaining should be Expiring Soon."""
        assert calculate_status(date_str(30)) == "Expiring Soon"

    def test_urgent_status(self):
        """A medicine expiring in 3 days should be Urgent."""
        assert calculate_status(date_str(3)) == "Urgent"

    def test_urgent_boundary_6_days(self):
        """6 days remaining should be Urgent (less than 7)."""
        assert calculate_status(date_str(6)) == "Urgent"

    def test_expired_status_yesterday(self):
        """A medicine that expired yesterday should be Expired."""
        assert calculate_status(date_str(-1)) == "Expired"

    def test_expired_status_long_ago(self):
        """A medicine that expired a year ago should still be Expired."""
        assert calculate_status(date_str(-365)) == "Expired"

    def test_accepts_date_object_not_just_string(self):
        """calculate_status should also work if given a date object directly."""
        future_date = date.today() + timedelta(days=100)
        assert calculate_status(future_date) == "Safe"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
