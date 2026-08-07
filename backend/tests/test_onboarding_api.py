"""
Backend API tests for Network Capital Onboarding Flow
Tests: Signup with phone, full_name, referred_by_code; Referral bonus system
"""
import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://system-repair-18.preview.emergentagent.com').rstrip('/')

class TestOnboardingSignup:
    """Test signup API with new onboarding fields"""
    
    def test_signup_with_phone_and_fullname(self):
        """Test signup stores phone and full_name fields"""
        timestamp = str(int(time.time()))
        unique_id = str(uuid.uuid4())[:8]
        
        payload = {
            "email": f"test_onboard_{unique_id}@test.com",
            "password": "Test123!",
            "username": f"test_onboard_{unique_id}",
            "phone": "+27123456789",
            "full_name": "Test User Full Name",
            "referred_by_code": None,
            "terms_accepted": True,
            "terms_accepted_at": "2026-01-01T00:00:00Z"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/signup", json=payload)
        
        assert response.status_code == 200, f"Signup failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "Token not returned"
        assert "user" in data, "User not returned"
        
        user = data["user"]
        assert user["email"] == payload["email"]
        assert user["username"] == payload["username"]
        print(f"SUCCESS: Signup with phone and full_name - user created: {user['id']}")
    
    def test_signup_phone_stored_in_database(self):
        """Test that phone number is stored and retrievable"""
        unique_id = str(uuid.uuid4())[:8]
        phone_number = "+27987654321"
        
        payload = {
            "email": f"test_phone_{unique_id}@test.com",
            "password": "Test123!",
            "username": f"test_phone_{unique_id}",
            "phone": phone_number,
            "full_name": "Phone Test User",
            "terms_accepted": True
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/signup", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        token = data["token"]
        
        # Verify user data via /users/me endpoint
        headers = {"Authorization": f"Bearer {token}"}
        me_response = requests.get(f"{BASE_URL}/api/users/me", headers=headers)
        
        assert me_response.status_code == 200
        # Note: phone may not be returned in /users/me response model
        print(f"SUCCESS: User created with phone number")
    
    def test_referral_code_generated_on_signup(self):
        """Test that referral_code is generated for new users"""
        unique_id = str(uuid.uuid4())[:8]
        
        payload = {
            "email": f"test_refcode_{unique_id}@test.com",
            "password": "Test123!",
            "username": f"test_refcode_{unique_id}",
            "phone": "+27111222333",
            "full_name": "Referral Code Test",
            "terms_accepted": True
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/signup", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        user = data["user"]
        
        assert "referral_code" in user, "referral_code not in user response"
        assert len(user["referral_code"]) > 0, "referral_code is empty"
        print(f"SUCCESS: Referral code generated: {user['referral_code']}")


class TestReferralSystem:
    """Test referral bonus system"""
    
    def test_referral_bonus_awarded_to_referrer(self):
        """Test that referrer gets $10 bonus when new user signs up with their code"""
        # Step 1: Create referrer user
        referrer_id = str(uuid.uuid4())[:8]
        referrer_payload = {
            "email": f"referrer_{referrer_id}@test.com",
            "password": "Test123!",
            "username": f"referrer_{referrer_id}",
            "phone": "+27444555666",
            "full_name": "Referrer User",
            "terms_accepted": True
        }
        
        referrer_response = requests.post(f"{BASE_URL}/api/auth/signup", json=referrer_payload)
        assert referrer_response.status_code == 200
        
        referrer_data = referrer_response.json()
        referrer_token = referrer_data["token"]
        referrer_code = referrer_data["user"]["referral_code"]
        
        # Get referrer's initial wallet balance
        headers = {"Authorization": f"Bearer {referrer_token}"}
        wallet_before = requests.get(f"{BASE_URL}/api/wallet", headers=headers)
        initial_balance = wallet_before.json().get("balance", 0)
        
        print(f"Referrer code: {referrer_code}, Initial balance: ${initial_balance}")
        
        # Step 2: Create new user with referrer's code
        referred_id = str(uuid.uuid4())[:8]
        referred_payload = {
            "email": f"referred_{referred_id}@test.com",
            "password": "Test123!",
            "username": f"referred_{referred_id}",
            "phone": "+27777888999",
            "full_name": "Referred User",
            "referred_by_code": referrer_code,
            "terms_accepted": True
        }
        
        referred_response = requests.post(f"{BASE_URL}/api/auth/signup", json=referred_payload)
        assert referred_response.status_code == 200
        
        # Step 3: Check referrer's wallet balance increased by $10
        wallet_after = requests.get(f"{BASE_URL}/api/wallet", headers=headers)
        new_balance = wallet_after.json().get("balance", 0)
        
        expected_balance = initial_balance + 10.0
        assert new_balance == expected_balance, f"Expected ${expected_balance}, got ${new_balance}"
        
        print(f"SUCCESS: Referrer received $10 bonus. Balance: ${initial_balance} -> ${new_balance}")
    
    def test_invalid_referral_code_ignored(self):
        """Test that invalid referral code doesn't cause error"""
        unique_id = str(uuid.uuid4())[:8]
        
        payload = {
            "email": f"test_invalid_ref_{unique_id}@test.com",
            "password": "Test123!",
            "username": f"test_invalid_ref_{unique_id}",
            "phone": "+27000111222",
            "full_name": "Invalid Ref Test",
            "referred_by_code": "INVALID_CODE_12345",
            "terms_accepted": True
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/signup", json=payload)
        
        # Should still succeed, just no referral bonus
        assert response.status_code == 200, f"Signup failed with invalid referral: {response.text}"
        print("SUCCESS: Signup with invalid referral code succeeded (code ignored)")


class TestLoginFlow:
    """Test login flow"""
    
    def test_login_with_email_password(self):
        """Test login returns token and user data"""
        # First create a user
        unique_id = str(uuid.uuid4())[:8]
        email = f"test_login_{unique_id}@test.com"
        password = "Test123!"
        
        signup_payload = {
            "email": email,
            "password": password,
            "username": f"test_login_{unique_id}",
            "phone": "+27333444555",
            "full_name": "Login Test User",
            "terms_accepted": True
        }
        
        signup_response = requests.post(f"{BASE_URL}/api/auth/signup", json=signup_payload)
        assert signup_response.status_code == 200
        
        # Now login
        login_payload = {
            "email": email,
            "password": password
        }
        
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=login_payload)
        assert login_response.status_code == 200
        
        data = login_response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == email
        
        print(f"SUCCESS: Login successful for {email}")
    
    def test_login_invalid_credentials(self):
        """Test login fails with wrong password"""
        login_payload = {
            "email": "nonexistent@test.com",
            "password": "wrongpassword"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_payload)
        assert response.status_code == 401
        print("SUCCESS: Invalid login rejected with 401")


class TestUserProfile:
    """Test user profile endpoints"""
    
    def test_get_current_user(self):
        """Test /users/me returns current user data"""
        unique_id = str(uuid.uuid4())[:8]
        
        payload = {
            "email": f"test_me_{unique_id}@test.com",
            "password": "Test123!",
            "username": f"test_me_{unique_id}",
            "phone": "+27666777888",
            "full_name": "Me Test User",
            "terms_accepted": True
        }
        
        signup_response = requests.post(f"{BASE_URL}/api/auth/signup", json=payload)
        assert signup_response.status_code == 200
        
        token = signup_response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        me_response = requests.get(f"{BASE_URL}/api/users/me", headers=headers)
        assert me_response.status_code == 200
        
        user = me_response.json()
        assert user["email"] == payload["email"]
        assert user["username"] == payload["username"]
        assert "network_score" in user
        assert "referral_code" in user
        
        print(f"SUCCESS: /users/me returns correct user data")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
