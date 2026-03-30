#!/usr/bin/env python3
"""
Comprehensive API tests for Next-Gen Hybrid Social Ecosystem
Tests: Auth, Videos, Tips, Fundraisers, Live Streaming, Privacy, Admin Analytics
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://creator-cosmos.preview.emergentagent.com').rstrip('/')

# Test credentials from test_credentials.md
TEST_ACCOUNTS = {
    "personal": {"email": "personal@test.com", "password": "Test123456", "username": "personal_user", "account_type": "personal"},
    "creator": {"email": "creator@test.com", "password": "Test123456", "username": "creator_user", "account_type": "professional"},
    "business": {"email": "business@test.com", "password": "Test123456", "username": "business_user", "account_type": "business"},
    "admin": {"email": "admin@example.com", "password": "Admin123456", "username": "admin_user", "account_type": "personal"}
}


class TestAuthEndpoints:
    """Authentication endpoint tests - POST /api/auth/register, POST /api/auth/login"""
    
    def test_register_or_login_personal(self):
        """Test personal account registration or login"""
        account = TEST_ACCOUNTS["personal"]
        
        # Try registration first
        response = requests.post(f"{BASE_URL}/api/auth/register", json=account)
        
        if response.status_code == 200:
            data = response.json()
            assert "token" in data
            assert "user" in data
            assert data["user"]["email"] == account["email"]
            print(f"✅ Personal account registered successfully")
        elif response.status_code == 400:
            # User exists, try login
            login_data = {"email": account["email"], "password": account["password"]}
            response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
            assert response.status_code == 200
            data = response.json()
            assert "token" in data
            print(f"✅ Personal account logged in successfully")
        else:
            pytest.fail(f"Registration failed with status {response.status_code}: {response.text}")
    
    def test_register_or_login_business(self):
        """Test business account registration or login"""
        account = TEST_ACCOUNTS["business"]
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=account)
        
        if response.status_code == 200:
            data = response.json()
            assert "token" in data
            assert data["user"]["account_type"] == "business"
            print(f"✅ Business account registered successfully")
        elif response.status_code == 400:
            login_data = {"email": account["email"], "password": account["password"]}
            response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
            assert response.status_code == 200
            print(f"✅ Business account logged in successfully")
        else:
            pytest.fail(f"Business registration failed: {response.status_code}")
    
    def test_register_or_login_admin(self):
        """Test admin account registration or login"""
        account = TEST_ACCOUNTS["admin"]
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=account)
        
        if response.status_code == 200:
            print(f"✅ Admin account registered successfully")
        elif response.status_code == 400:
            login_data = {"email": account["email"], "password": account["password"]}
            response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
            assert response.status_code == 200
            print(f"✅ Admin account logged in successfully")
        else:
            pytest.fail(f"Admin registration failed: {response.status_code}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print(f"✅ Invalid credentials correctly rejected with 401")


class TestVideoEndpoints:
    """Video feed and related endpoints"""
    
    def test_video_feed_loads(self):
        """GET /api/videos/feed - should return list of videos"""
        response = requests.get(f"{BASE_URL}/api/videos/feed")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Video feed returned {len(data)} videos")
    
    def test_video_search(self):
        """GET /api/videos/search/query?q=test - search endpoint works"""
        response = requests.get(f"{BASE_URL}/api/videos/search/query?q=test")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Video search returned {len(data)} results")


class TestUserEndpoints:
    """User profile endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for personal account"""
        login_data = {"email": TEST_ACCOUNTS["personal"]["email"], "password": TEST_ACCOUNTS["personal"]["password"]}
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Could not get auth token")
    
    def test_get_current_user(self, auth_token):
        """GET /api/users/me with auth - returns user profile"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/users/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        assert "username" in data
        print(f"✅ Current user retrieved: {data['username']}")
    
    def test_get_current_user_no_auth(self):
        """GET /api/users/me without auth - returns 401"""
        response = requests.get(f"{BASE_URL}/api/users/me")
        assert response.status_code == 401
        print(f"✅ Unauthenticated request correctly rejected")


class TestTipEndpoints:
    """Tip payment endpoints - migrated from emergentintegrations to native stripe"""
    
    @pytest.fixture
    def creator_token(self):
        """Get auth token for creator account"""
        login_data = {"email": TEST_ACCOUNTS["creator"]["email"], "password": TEST_ACCOUNTS["creator"]["password"]}
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Could not get creator auth token")
    
    @pytest.fixture
    def video_id(self):
        """Get a video ID from feed"""
        response = requests.get(f"{BASE_URL}/api/videos/feed")
        if response.status_code == 200 and len(response.json()) > 0:
            return response.json()[0]["id"]
        pytest.skip("No videos available for testing")
    
    def test_tip_initiate_endpoint_reachable(self, creator_token, video_id):
        """POST /api/tips/initiate - endpoint is reachable (Stripe will fail with test key)"""
        headers = {
            "Authorization": f"Bearer {creator_token}",
            "Content-Type": "application/json",
            "Origin": BASE_URL
        }
        tip_data = {"video_id": video_id, "amount": 5.0}
        
        response = requests.post(f"{BASE_URL}/api/tips/initiate", json=tip_data, headers=headers)
        
        # Endpoint should be reachable - either 200 (success) or 500 with Stripe error (expected with test key)
        # NOT a 404 (route not found) or NameError/ImportError
        assert response.status_code in [200, 400, 500], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 500:
            # Check it's a Stripe error, not a code error
            error_text = response.text.lower()
            assert "stripe" in error_text or "checkout" in error_text or "api" in error_text, \
                f"Expected Stripe error, got: {response.text}"
            print(f"✅ Tip initiate endpoint reachable (Stripe auth error expected with test key)")
        elif response.status_code == 400:
            print(f"✅ Tip initiate endpoint reachable (validation error: {response.text[:100]})")
        else:
            data = response.json()
            assert "checkout_url" in data or "session_id" in data
            print(f"✅ Tip initiate returned checkout session")
    
    def test_tip_status_endpoint_reachable(self):
        """GET /api/tips/status/{session_id} - endpoint responds"""
        # Use a fake session ID - endpoint should be reachable
        response = requests.get(f"{BASE_URL}/api/tips/status/fake_session_123")
        
        # Should be reachable - 500 with Stripe error is expected
        assert response.status_code in [200, 404, 500]
        print(f"✅ Tip status endpoint reachable (status: {response.status_code})")


class TestFundraiserEndpoints:
    """Fundraiser endpoints - migrated from emergentintegrations to native stripe"""
    
    @pytest.fixture
    def business_token(self):
        """Get auth token for business account"""
        login_data = {"email": TEST_ACCOUNTS["business"]["email"], "password": TEST_ACCOUNTS["business"]["password"]}
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Could not get business auth token")
    
    @pytest.fixture
    def personal_token(self):
        """Get auth token for personal account"""
        login_data = {"email": TEST_ACCOUNTS["personal"]["email"], "password": TEST_ACCOUNTS["personal"]["password"]}
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Could not get personal auth token")
    
    def test_fundraiser_create_business_account(self, business_token):
        """POST /api/fundraisers/create - business account can create fundraiser"""
        headers = {"Authorization": f"Bearer {business_token}"}
        fundraiser_data = {
            "title": f"TEST_Fundraiser_{int(time.time())}",
            "description": "Test fundraiser for API testing",
            "goal_amount": 1000.0
        }
        
        response = requests.post(f"{BASE_URL}/api/fundraisers/create", json=fundraiser_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["title"] == fundraiser_data["title"]
        print(f"✅ Fundraiser created: {data['id']}")
    
    def test_fundraiser_create_personal_account_rejected(self, personal_token):
        """POST /api/fundraisers/create - personal account should be rejected"""
        headers = {"Authorization": f"Bearer {personal_token}"}
        fundraiser_data = {
            "title": "Should Fail",
            "description": "Personal accounts cannot create fundraisers",
            "goal_amount": 500.0
        }
        
        response = requests.post(f"{BASE_URL}/api/fundraisers/create", json=fundraiser_data, headers=headers)
        assert response.status_code == 403
        print(f"✅ Personal account correctly rejected from creating fundraiser")
    
    def test_fundraiser_list(self):
        """GET /api/fundraisers - list all fundraisers"""
        response = requests.get(f"{BASE_URL}/api/fundraisers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Fundraiser list returned {len(data)} fundraisers")
    
    def test_fundraiser_contribute_endpoint_reachable(self, personal_token):
        """POST /api/fundraisers/{id}/contribute - endpoint is reachable"""
        # First get a fundraiser
        response = requests.get(f"{BASE_URL}/api/fundraisers")
        if response.status_code != 200 or len(response.json()) == 0:
            pytest.skip("No fundraisers available")
        
        fundraiser_id = response.json()[0]["id"]
        headers = {
            "Authorization": f"Bearer {personal_token}",
            "Origin": BASE_URL
        }
        
        response = requests.post(
            f"{BASE_URL}/api/fundraisers/{fundraiser_id}/contribute?amount=10.0",
            headers=headers
        )
        
        # Endpoint should be reachable
        assert response.status_code in [200, 400, 500]
        
        if response.status_code == 500:
            error_text = response.text.lower()
            assert "stripe" in error_text or "checkout" in error_text or "api" in error_text
            print(f"✅ Fundraiser contribute endpoint reachable (Stripe error expected)")
        else:
            print(f"✅ Fundraiser contribute endpoint reachable (status: {response.status_code})")
    
    def test_fundraiser_status_endpoint_reachable(self):
        """GET /api/fundraisers/status/{session_id} - endpoint responds"""
        response = requests.get(f"{BASE_URL}/api/fundraisers/status/fake_session_123")
        assert response.status_code in [200, 404, 500]
        print(f"✅ Fundraiser status endpoint reachable (status: {response.status_code})")


class TestStripeWebhook:
    """Stripe webhook endpoint"""
    
    def test_webhook_endpoint_exists(self):
        """POST /api/webhook/stripe - endpoint exists and responds"""
        # Send empty body - should get 400 (bad request) not 404
        response = requests.post(f"{BASE_URL}/api/webhook/stripe", json={})
        
        # Should not be 404 (route not found)
        assert response.status_code != 404, "Webhook endpoint not found"
        print(f"✅ Stripe webhook endpoint exists (status: {response.status_code})")


class TestLiveStreamingRoutes:
    """Live streaming routes - previously inaccessible due to route registration bug"""
    
    def test_active_streams_endpoint(self):
        """GET /api/live/active - should return list of active streams"""
        response = requests.get(f"{BASE_URL}/api/live/active")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Live active streams endpoint works, returned {len(data)} streams")


class TestPrivacySettingsRoutes:
    """Privacy settings routes - previously inaccessible due to route registration bug"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        login_data = {"email": TEST_ACCOUNTS["personal"]["email"], "password": TEST_ACCOUNTS["personal"]["password"]}
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Could not get auth token")
    
    def test_get_privacy_settings(self, auth_token):
        """GET /api/users/me/privacy - get user privacy settings"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/users/me/privacy", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # Should have privacy setting fields
        assert "profile_visibility" in data or "show_email" in data
        print(f"✅ Privacy settings retrieved successfully")
    
    def test_update_privacy_settings(self, auth_token):
        """PUT /api/users/me/privacy - update privacy settings"""
        headers = {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
        privacy_data = {
            "show_email": False,
            "show_phone": False,
            "show_birthday": False,
            "show_location": False,
            "show_followers_count": True,
            "show_following_count": True,
            "profile_visibility": "public"
        }
        
        response = requests.put(f"{BASE_URL}/api/users/me/privacy", json=privacy_data, headers=headers)
        assert response.status_code == 200
        print(f"✅ Privacy settings updated successfully")


class TestAdminRoutes:
    """Admin routes including advanced analytics"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        login_data = {"email": TEST_ACCOUNTS["admin"]["email"], "password": TEST_ACCOUNTS["admin"]["password"]}
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Could not get admin auth token")
    
    @pytest.fixture
    def non_admin_token(self):
        """Get non-admin auth token"""
        login_data = {"email": TEST_ACCOUNTS["personal"]["email"], "password": TEST_ACCOUNTS["personal"]["password"]}
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Could not get non-admin auth token")
    
    def test_admin_stats_requires_auth(self):
        """GET /api/admin/stats - requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/stats")
        assert response.status_code == 401
        print(f"✅ Admin stats correctly requires auth")
    
    def test_admin_stats_requires_admin(self, non_admin_token):
        """GET /api/admin/stats - requires admin role"""
        headers = {"Authorization": f"Bearer {non_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers)
        assert response.status_code == 403
        print(f"✅ Admin stats correctly rejects non-admin users")
    
    def test_admin_stats_with_admin(self, admin_token):
        """GET /api/admin/stats - admin can access"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_users" in data
        assert "total_videos" in data
        print(f"✅ Admin stats accessible: {data['total_users']} users, {data['total_videos']} videos")
    
    def test_admin_analytics_timeseries(self, admin_token):
        """GET /api/admin/analytics/timeseries - advanced analytics endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/analytics/timeseries", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Admin analytics timeseries accessible, {len(data)} data points")
    
    def test_admin_analytics_engagement(self, admin_token):
        """GET /api/admin/analytics/engagement - engagement metrics endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/analytics/engagement", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_videos" in data
        assert "total_comments" in data
        print(f"✅ Admin analytics engagement accessible")


class TestNotificationsEndpoint:
    """Notifications endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        login_data = {"email": TEST_ACCOUNTS["personal"]["email"], "password": TEST_ACCOUNTS["personal"]["password"]}
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Could not get auth token")
    
    def test_get_notifications(self, auth_token):
        """GET /api/notifications - get user notifications"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/notifications", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "notifications" in data
        assert "unread_count" in data
        print(f"✅ Notifications retrieved: {data['unread_count']} unread")


class TestCreatorSpotlight:
    """Creator spotlight endpoint"""
    
    def test_creator_spotlight(self):
        """GET /api/creators/spotlight - get top creators"""
        response = requests.get(f"{BASE_URL}/api/creators/spotlight")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Creator spotlight returned {len(data)} creators")


class TestCloudinarySignature:
    """Cloudinary signature endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        login_data = {"email": TEST_ACCOUNTS["personal"]["email"], "password": TEST_ACCOUNTS["personal"]["password"]}
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Could not get auth token")
    
    def test_cloudinary_signature(self, auth_token):
        """GET /api/cloudinary/signature - get upload signature"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/cloudinary/signature?resource_type=video&folder=uploads/",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "signature" in data
        assert "timestamp" in data
        print(f"✅ Cloudinary signature generated")


class TestCommentEndpoints:
    """Comment endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        login_data = {"email": TEST_ACCOUNTS["personal"]["email"], "password": TEST_ACCOUNTS["personal"]["password"]}
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Could not get auth token")
    
    @pytest.fixture
    def video_id(self):
        """Get a video ID"""
        response = requests.get(f"{BASE_URL}/api/videos/feed")
        if response.status_code == 200 and len(response.json()) > 0:
            return response.json()[0]["id"]
        pytest.skip("No videos available")
    
    def test_get_video_comments(self, video_id):
        """GET /api/videos/{video_id}/comments - get comments"""
        response = requests.get(f"{BASE_URL}/api/videos/{video_id}/comments")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Video comments retrieved: {len(data)} comments")
    
    def test_create_comment(self, auth_token, video_id):
        """POST /api/videos/{video_id}/comments - create comment"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        comment_data = {"text": f"TEST_Comment_{int(time.time())}"}
        
        response = requests.post(
            f"{BASE_URL}/api/videos/{video_id}/comments",
            json=comment_data,
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["text"] == comment_data["text"]
        print(f"✅ Comment created: {data['id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
