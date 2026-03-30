#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import time

class SocialEcosystemAPITester:
    def __init__(self, base_url="https://creator-cosmos.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tokens = {}  # Store tokens for different account types
        self.users = {}   # Store user data for different account types
        self.test_video_id = None
        self.test_fundraiser_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
            self.failed_tests.append(f"{name}: {details}")

    def make_request(self, method, endpoint, data=None, token=None, expected_status=200):
        """Make HTTP request with error handling"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            return success, response.json() if success else response.text, response.status_code

        except Exception as e:
            return False, str(e), 0

    def test_user_registration(self):
        """Test user registration for all account types"""
        print("\n🔍 Testing User Registration...")
        
        test_accounts = [
            {"email": "personal@test.com", "password": "Test123456", "username": "personal_user", "account_type": "personal"},
            {"email": "creator@test.com", "password": "Test123456", "username": "creator_user", "account_type": "professional"},
            {"email": "business@test.com", "password": "Test123456", "username": "business_user", "account_type": "business"}
        ]

        for account in test_accounts:
            success, response, status = self.make_request('POST', 'auth/register', account, expected_status=200)
            
            if success:
                self.tokens[account['account_type']] = response['token']
                self.users[account['account_type']] = response['user']
                self.log_test(f"Register {account['account_type']} account", True)
            else:
                # Try login if registration fails (user might already exist)
                login_data = {"email": account["email"], "password": account["password"]}
                success, response, status = self.make_request('POST', 'auth/login', login_data, expected_status=200)
                
                if success:
                    self.tokens[account['account_type']] = response['token']
                    self.users[account['account_type']] = response['user']
                    self.log_test(f"Login {account['account_type']} account (existing)", True)
                else:
                    self.log_test(f"Register/Login {account['account_type']} account", False, f"Status: {status}")

    def test_user_login(self):
        """Test user login"""
        print("\n🔍 Testing User Login...")
        
        login_data = {"email": "personal@test.com", "password": "Test123456"}
        success, response, status = self.make_request('POST', 'auth/login', login_data, expected_status=200)
        
        if success and 'token' in response:
            self.log_test("User login", True)
        else:
            self.log_test("User login", False, f"Status: {status}")

    def test_get_current_user(self):
        """Test getting current user data"""
        print("\n🔍 Testing Get Current User...")
        
        if 'personal' in self.tokens:
            success, response, status = self.make_request('GET', 'users/me', token=self.tokens['personal'])
            self.log_test("Get current user", success, f"Status: {status}" if not success else "")
        else:
            self.log_test("Get current user", False, "No token available")

    def test_get_user_profile(self):
        """Test getting user profile by username"""
        print("\n🔍 Testing Get User Profile...")
        
        if 'personal' in self.users:
            username = self.users['personal']['username']
            success, response, status = self.make_request('GET', f'users/{username}')
            self.log_test("Get user profile", success, f"Status: {status}" if not success else "")
        else:
            self.log_test("Get user profile", False, "No user data available")

    def test_cloudinary_signature(self):
        """Test Cloudinary signature generation"""
        print("\n🔍 Testing Cloudinary Signature...")
        
        if 'personal' in self.tokens:
            success, response, status = self.make_request('GET', 'cloudinary/signature?resource_type=video&folder=uploads', token=self.tokens['personal'])
            self.log_test("Get Cloudinary signature", success, f"Status: {status}" if not success else "")
        else:
            self.log_test("Get Cloudinary signature", False, "No token available")

    def test_video_upload(self):
        """Test video upload (metadata only, no actual file)"""
        print("\n🔍 Testing Video Upload...")
        
        if 'personal' in self.tokens:
            video_data = {
                "cloudinary_public_id": "test_video_123",
                "cloudinary_url": "https://res.cloudinary.com/test/video/upload/test_video_123.mp4",
                "aspect_ratio": "9:16",
                "title": "Test Video",
                "description": "This is a test video"
            }
            
            success, response, status = self.make_request('POST', 'videos/upload', video_data, token=self.tokens['personal'])
            
            if success:
                self.test_video_id = response['id']
                self.log_test("Upload video metadata", True)
            else:
                self.log_test("Upload video metadata", False, f"Status: {status}")
        else:
            self.log_test("Upload video metadata", False, "No token available")

    def test_video_feed(self):
        """Test getting video feed"""
        print("\n🔍 Testing Video Feed...")
        
        success, response, status = self.make_request('GET', 'videos/feed')
        self.log_test("Get video feed", success, f"Status: {status}" if not success else "")

    def test_video_view_increment(self):
        """Test incrementing video views"""
        print("\n🔍 Testing Video View Increment...")
        
        if self.test_video_id:
            success, response, status = self.make_request('POST', f'videos/{self.test_video_id}/view')
            self.log_test("Increment video view", success, f"Status: {status}" if not success else "")
        else:
            self.log_test("Increment video view", False, "No test video available")

    def test_tip_initiation(self):
        """Test tip initiation"""
        print("\n🔍 Testing Tip Initiation...")
        
        if self.test_video_id and 'personal' in self.tokens:
            tip_data = {
                "video_id": self.test_video_id,
                "amount": 5.0
            }
            
            # Add Origin header for tip request
            url = f"{self.api_url}/tips/initiate"
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {self.tokens["personal"]}',
                'Origin': self.base_url
            }
            
            try:
                response = requests.post(url, json=tip_data, headers=headers)
                success = response.status_code == 200
                self.log_test("Initiate tip", success, f"Status: {response.status_code}" if not success else "")
            except Exception as e:
                self.log_test("Initiate tip", False, str(e))
        else:
            self.log_test("Initiate tip", False, "No test video or token available")

    def test_fundraiser_creation(self):
        """Test fundraiser creation (business accounts only)"""
        print("\n🔍 Testing Fundraiser Creation...")
        
        if 'business' in self.tokens:
            fundraiser_data = {
                "title": "Test Fundraiser",
                "description": "This is a test fundraiser for our business",
                "goal_amount": 1000.0
            }
            
            success, response, status = self.make_request('POST', 'fundraisers/create', fundraiser_data, token=self.tokens['business'])
            
            if success:
                self.test_fundraiser_id = response['id']
                self.log_test("Create fundraiser", True)
            else:
                self.log_test("Create fundraiser", False, f"Status: {status}")
        else:
            self.log_test("Create fundraiser", False, "No business token available")

    def test_get_fundraisers(self):
        """Test getting fundraisers list"""
        print("\n🔍 Testing Get Fundraisers...")
        
        success, response, status = self.make_request('GET', 'fundraisers')
        self.log_test("Get fundraisers", success, f"Status: {status}" if not success else "")

    def test_analytics_dashboard(self):
        """Test analytics dashboard"""
        print("\n🔍 Testing Analytics Dashboard...")
        
        if 'personal' in self.tokens:
            success, response, status = self.make_request('GET', 'analytics/dashboard', token=self.tokens['personal'])
            self.log_test("Get analytics dashboard", success, f"Status: {status}" if not success else "")
        else:
            self.log_test("Get analytics dashboard", False, "No token available")

    def test_moderation_flag(self):
        """Test content moderation flagging"""
        print("\n🔍 Testing Content Moderation...")
        
        if self.test_video_id and 'personal' in self.tokens:
            flag_data = {
                "video_id": self.test_video_id,
                "reason": "Test flag for inappropriate content"
            }
            
            success, response, status = self.make_request('POST', 'moderation/flag', flag_data, token=self.tokens['personal'])
            self.log_test("Flag video for moderation", success, f"Status: {status}" if not success else "")
        else:
            self.log_test("Flag video for moderation", False, "No test video or token available")

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Social Ecosystem API Tests...")
        print(f"Testing against: {self.base_url}")
        
        # Authentication tests
        self.test_user_registration()
        self.test_user_login()
        self.test_get_current_user()
        self.test_get_user_profile()
        
        # Cloudinary tests
        self.test_cloudinary_signature()
        
        # Video tests
        self.test_video_upload()
        self.test_video_feed()
        self.test_video_view_increment()
        
        # Payment tests
        self.test_tip_initiation()
        
        # Fundraiser tests
        self.test_fundraiser_creation()
        self.test_get_fundraisers()
        
        # Analytics tests
        self.test_analytics_dashboard()
        
        # Moderation tests
        self.test_moderation_flag()
        
        # Print summary
        print(f"\n📊 Test Summary:")
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ Failed Tests:")
            for failed_test in self.failed_tests:
                print(f"  - {failed_test}")
        
        return self.tests_passed == self.tests_run

if __name__ == "__main__":
    tester = SocialEcosystemAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)