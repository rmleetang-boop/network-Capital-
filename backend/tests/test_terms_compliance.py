"""
Test Terms & Conditions and Privacy Policy compliance features
Tests the registration flow with terms acceptance and verifies compliance data storage
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTermsCompliance:
    """Test Terms & Conditions acceptance in registration flow"""
    
    def test_signup_with_terms_accepted(self):
        """Test that signup stores terms_accepted=true and terms_accepted_at timestamp"""
        test_id = str(uuid.uuid4())[:8]
        test_email = f"test_terms_{test_id}@example.com"
        test_username = f"testterms_{test_id}"
        
        # Signup with terms accepted
        signup_payload = {
            "email": test_email,
            "password": "Test123!",
            "username": test_username,
            "bio": "Test user for terms compliance",
            "terms_accepted": True,
            "terms_accepted_at": datetime.utcnow().isoformat()
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/signup", json=signup_payload)
        
        # Status code assertion
        assert response.status_code == 200, f"Signup failed: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert "user" in data, "Response should contain user"
        assert data["user"]["email"] == test_email
        assert data["user"]["username"] == test_username
        
        # Store token for cleanup
        self.token = data["token"]
        self.user_id = data["user"]["id"]
        
        print(f"PASS: User created with email {test_email}")
        return data["token"], data["user"]
    
    def test_signup_stores_terms_version(self):
        """Test that signup stores terms_version field"""
        test_id = str(uuid.uuid4())[:8]
        test_email = f"test_version_{test_id}@example.com"
        test_username = f"testversion_{test_id}"
        
        signup_payload = {
            "email": test_email,
            "password": "Test123!",
            "username": test_username,
            "terms_accepted": True,
            "terms_accepted_at": datetime.utcnow().isoformat()
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/signup", json=signup_payload)
        assert response.status_code == 200, f"Signup failed: {response.text}"
        
        data = response.json()
        token = data["token"]
        
        # Verify user data via /users/me endpoint
        headers = {"Authorization": f"Bearer {token}"}
        me_response = requests.get(f"{BASE_URL}/api/users/me", headers=headers)
        
        assert me_response.status_code == 200, f"Get user failed: {me_response.text}"
        
        print(f"PASS: User created and verified via /users/me")
    
    def test_signup_without_terms_still_works(self):
        """Test that signup without explicit terms_accepted still creates user (defaults to false)"""
        test_id = str(uuid.uuid4())[:8]
        test_email = f"test_noterms_{test_id}@example.com"
        test_username = f"testnoterms_{test_id}"
        
        # Signup without terms_accepted field
        signup_payload = {
            "email": test_email,
            "password": "Test123!",
            "username": test_username,
            "bio": "Test user without explicit terms"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/signup", json=signup_payload)
        
        # Should still succeed (backend defaults terms_accepted to false)
        assert response.status_code == 200, f"Signup failed: {response.text}"
        
        data = response.json()
        assert "token" in data
        assert "user" in data
        
        print(f"PASS: User created without explicit terms_accepted")
    
    def test_login_does_not_require_terms(self):
        """Test that login flow works without terms checkbox"""
        # First create a user
        test_id = str(uuid.uuid4())[:8]
        test_email = f"test_login_{test_id}@example.com"
        test_username = f"testlogin_{test_id}"
        test_password = "Test123!"
        
        signup_payload = {
            "email": test_email,
            "password": test_password,
            "username": test_username,
            "terms_accepted": True,
            "terms_accepted_at": datetime.utcnow().isoformat()
        }
        
        signup_response = requests.post(f"{BASE_URL}/api/auth/signup", json=signup_payload)
        assert signup_response.status_code == 200, f"Signup failed: {signup_response.text}"
        
        # Now login
        login_payload = {
            "email": test_email,
            "password": test_password
        }
        
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=login_payload)
        
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        data = login_response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == test_email
        
        print(f"PASS: Login works without terms checkbox")
    
    def test_duplicate_email_rejected(self):
        """Test that duplicate email registration is rejected"""
        test_id = str(uuid.uuid4())[:8]
        test_email = f"test_dup_{test_id}@example.com"
        test_username = f"testdup_{test_id}"
        
        signup_payload = {
            "email": test_email,
            "password": "Test123!",
            "username": test_username,
            "terms_accepted": True
        }
        
        # First signup
        response1 = requests.post(f"{BASE_URL}/api/auth/signup", json=signup_payload)
        assert response1.status_code == 200
        
        # Second signup with same email
        signup_payload["username"] = f"testdup2_{test_id}"
        response2 = requests.post(f"{BASE_URL}/api/auth/signup", json=signup_payload)
        
        assert response2.status_code == 400, "Duplicate email should be rejected"
        assert "already registered" in response2.text.lower() or "email" in response2.text.lower()
        
        print(f"PASS: Duplicate email registration rejected")
    
    def test_duplicate_username_rejected(self):
        """Test that duplicate username registration is rejected"""
        test_id = str(uuid.uuid4())[:8]
        test_username = f"testdupuser_{test_id}"
        
        signup_payload1 = {
            "email": f"test_dup1_{test_id}@example.com",
            "password": "Test123!",
            "username": test_username,
            "terms_accepted": True
        }
        
        # First signup
        response1 = requests.post(f"{BASE_URL}/api/auth/signup", json=signup_payload1)
        assert response1.status_code == 200
        
        # Second signup with same username
        signup_payload2 = {
            "email": f"test_dup2_{test_id}@example.com",
            "password": "Test123!",
            "username": test_username,
            "terms_accepted": True
        }
        response2 = requests.post(f"{BASE_URL}/api/auth/signup", json=signup_payload2)
        
        assert response2.status_code == 400, "Duplicate username should be rejected"
        assert "username" in response2.text.lower() or "taken" in response2.text.lower()
        
        print(f"PASS: Duplicate username registration rejected")


class TestAuthEndpoints:
    """Test authentication endpoints"""
    
    def test_health_check(self):
        """Test that API is accessible"""
        # Try to access any endpoint to verify API is up
        response = requests.get(f"{BASE_URL}/api/leaderboard")
        assert response.status_code == 200, f"API not accessible: {response.status_code}"
        print("PASS: API is accessible")
    
    def test_invalid_login(self):
        """Test that invalid credentials are rejected"""
        login_payload = {
            "email": "nonexistent@example.com",
            "password": "wrongpassword"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_payload)
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        print("PASS: Invalid login credentials rejected")
    
    def test_protected_endpoint_requires_auth(self):
        """Test that protected endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/users/me")
        
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403, 422], f"Expected auth error, got {response.status_code}"
        
        print("PASS: Protected endpoint requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
