"""
Backend API Tests for Network Capital Stokvel+ Platform
Tests: Auth, Wallet, Stokvels, Contributions, Scores, Rewards, Leaderboards
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials
TEST_EMAIL = f"test_{uuid.uuid4().hex[:8]}@example.com"
TEST_PASSWORD = "Test123!"
TEST_USERNAME = f"testuser_{uuid.uuid4().hex[:8]}"

# Global state for tests
test_state = {
    "token": None,
    "user_id": None,
    "stokvel_id": None,
    "wallet_balance": 0.0
}


class TestHealthAndAuth:
    """Authentication endpoint tests"""
    
    def test_signup_success(self):
        """Test user registration"""
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "username": TEST_USERNAME,
            "bio": "Test user bio",
            "photo": ""
        })
        
        assert response.status_code == 200, f"Signup failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "token" in data, "Token missing from signup response"
        assert "user" in data, "User data missing from signup response"
        assert data["user"]["email"] == TEST_EMAIL
        assert data["user"]["username"] == TEST_USERNAME
        assert data["user"]["network_score"] == 0
        assert data["user"]["rank"] == "Rising Star"
        
        # Store for subsequent tests
        test_state["token"] = data["token"]
        test_state["user_id"] = data["user"]["id"]
        print(f"User registered: {TEST_USERNAME}, ID: {test_state['user_id']}")
    
    def test_signup_duplicate_email(self):
        """Test duplicate email rejection"""
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "username": f"another_{uuid.uuid4().hex[:8]}",
            "bio": "",
            "photo": ""
        })
        
        assert response.status_code == 400
        assert "already registered" in response.json().get("detail", "").lower()
    
    def test_login_success(self):
        """Test user login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        
        # Update token
        test_state["token"] = data["token"]
    
    def test_login_invalid_credentials(self):
        """Test login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": "WrongPassword123!"
        })
        
        assert response.status_code == 401
    
    def test_get_current_user(self):
        """Test getting current user profile"""
        headers = {"Authorization": f"Bearer {test_state['token']}"}
        response = requests.get(f"{BASE_URL}/api/users/me", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["email"] == TEST_EMAIL
        assert data["username"] == TEST_USERNAME


class TestWallet:
    """Wallet endpoint tests"""
    
    def test_get_wallet_initial(self):
        """Test getting wallet balance (should be 0 initially)"""
        headers = {"Authorization": f"Bearer {test_state['token']}"}
        response = requests.get(f"{BASE_URL}/api/wallet", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "balance" in data
        assert data["balance"] == 0.0
        test_state["wallet_balance"] = data["balance"]
    
    def test_deposit_funds(self):
        """Test depositing funds to wallet"""
        headers = {"Authorization": f"Bearer {test_state['token']}"}
        deposit_amount = 100.0
        
        response = requests.post(f"{BASE_URL}/api/wallet/deposit", 
            headers=headers,
            json={"amount": deposit_amount}
        )
        
        assert response.status_code == 200, f"Deposit failed: {response.text}"
        data = response.json()
        
        assert "new_balance" in data
        assert data["new_balance"] == deposit_amount
        test_state["wallet_balance"] = data["new_balance"]
        print(f"Deposited ${deposit_amount}, new balance: ${data['new_balance']}")
    
    def test_get_wallet_after_deposit(self):
        """Verify wallet balance after deposit"""
        headers = {"Authorization": f"Bearer {test_state['token']}"}
        response = requests.get(f"{BASE_URL}/api/wallet", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["balance"] == 100.0
        assert data["total_earned"] == 100.0
    
    def test_get_transactions(self):
        """Test getting transaction history"""
        headers = {"Authorization": f"Bearer {test_state['token']}"}
        response = requests.get(f"{BASE_URL}/api/wallet/transactions", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) >= 1  # At least the deposit
        assert data[0]["type"] == "deposit"


class TestStokvel:
    """Stokvel CRUD and operations tests"""
    
    def test_create_stokvel_insufficient_balance(self):
        """Test creating stokvel without sufficient balance"""
        # First, create a new user with no balance
        new_email = f"poor_{uuid.uuid4().hex[:8]}@example.com"
        signup_resp = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": new_email,
            "password": TEST_PASSWORD,
            "username": f"poor_{uuid.uuid4().hex[:8]}",
            "bio": "",
            "photo": ""
        })
        
        if signup_resp.status_code == 200:
            poor_token = signup_resp.json()["token"]
            headers = {"Authorization": f"Bearer {poor_token}"}
            
            response = requests.post(f"{BASE_URL}/api/stokvels", 
                headers=headers,
                json={
                    "name": "Test Stokvel",
                    "description": "Test description",
                    "target_amount": 1000.0,
                    "payout_cycle": "Monthly"
                }
            )
            
            assert response.status_code == 400
            assert "insufficient" in response.json().get("detail", "").lower()
    
    def test_create_stokvel_success(self):
        """Test creating a stokvel ($10 fee deduction)"""
        headers = {"Authorization": f"Bearer {test_state['token']}"}
        
        response = requests.post(f"{BASE_URL}/api/stokvels", 
            headers=headers,
            json={
                "name": f"TEST_Stokvel_{uuid.uuid4().hex[:6]}",
                "description": "Test stokvel for automated testing",
                "target_amount": 5000.0,
                "payout_cycle": "Monthly"
            }
        )
        
        assert response.status_code == 200, f"Create stokvel failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert data["total_pool"] == 0
        assert data["target_amount"] == 5000.0
        assert data["status"] == "active"
        assert len(data["members"]) == 1  # Creator is first member
        
        test_state["stokvel_id"] = data["id"]
        print(f"Stokvel created: {data['name']}, ID: {data['id']}")
    
    def test_wallet_balance_after_stokvel_creation(self):
        """Verify $10 fee was deducted from wallet"""
        headers = {"Authorization": f"Bearer {test_state['token']}"}
        response = requests.get(f"{BASE_URL}/api/wallet", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Started with $100, $10 fee deducted
        assert data["balance"] == 90.0, f"Expected $90, got ${data['balance']}"
        test_state["wallet_balance"] = data["balance"]
    
    def test_get_stokvels_list(self):
        """Test getting user's stokvels"""
        headers = {"Authorization": f"Bearer {test_state['token']}"}
        response = requests.get(f"{BASE_URL}/api/stokvels", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) >= 1
        
        # Find our test stokvel
        test_stokvel = next((s for s in data if s["id"] == test_state["stokvel_id"]), None)
        assert test_stokvel is not None
    
    def test_get_stokvel_detail(self):
        """Test getting stokvel details"""
        headers = {"Authorization": f"Bearer {test_state['token']}"}
        response = requests.get(f"{BASE_URL}/api/stokvels/{test_state['stokvel_id']}", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == test_state["stokvel_id"]
        assert "members" in data
        assert "total_pool" in data
        assert "group_strength" in data
    
    def test_get_stokvel_strength(self):
        """Test getting stokvel strength metrics"""
        headers = {"Authorization": f"Bearer {test_state['token']}"}
        response = requests.get(f"{BASE_URL}/api/stokvels/{test_state['stokvel_id']}/strength", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "score" in data
        assert "level" in data
        assert "member_count" in data
        assert data["member_count"] == 1


class TestContributions:
    """Contribution tests"""
    
    def test_contribute_to_stokvel(self):
        """Test making a contribution"""
        headers = {"Authorization": f"Bearer {test_state['token']}"}
        contribution_amount = 50.0
        
        response = requests.post(
            f"{BASE_URL}/api/stokvels/{test_state['stokvel_id']}/contribute",
            headers=headers,
            json={
                "amount": contribution_amount,
                "note": "Test contribution"
            }
        )
        
        assert response.status_code == 200, f"Contribution failed: {response.text}"
        data = response.json()
        
        assert data["amount"] == contribution_amount
        assert data["stokvel_id"] == test_state["stokvel_id"]
        print(f"Contributed ${contribution_amount}")
    
    def test_get_contributions(self):
        """Test getting contribution history"""
        headers = {"Authorization": f"Bearer {test_state['token']}"}
        response = requests.get(
            f"{BASE_URL}/api/stokvels/{test_state['stokvel_id']}/contributions",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["amount"] == 50.0
    
    def test_stokvel_pool_updated(self):
        """Verify stokvel pool was updated after contribution"""
        headers = {"Authorization": f"Bearer {test_state['token']}"}
        response = requests.get(f"{BASE_URL}/api/stokvels/{test_state['stokvel_id']}", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total_pool"] >= 50.0  # At least our contribution


class TestScoreAndRewards:
    """Network Score and Rewards tests"""
    
    def test_get_my_score(self):
        """Test getting user's network score for stokvel"""
        headers = {"Authorization": f"Bearer {test_state['token']}"}
        response = requests.get(
            f"{BASE_URL}/api/stokvels/{test_state['stokvel_id']}/my-score",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get score failed: {response.text}"
        data = response.json()
        
        assert "individual_score" in data
        assert "contribution_consistency_score" in data
        assert "contribution_amount_score" in data
        assert "engagement_score" in data
        assert "referral_score" in data
        assert "group_health_score" in data
        assert "tier" in data
        assert "streak_days" in data
        
        print(f"User score: {data['individual_score']}, Tier: {data['tier']}")
    
    def test_get_group_score(self):
        """Test getting group's network score"""
        headers = {"Authorization": f"Bearer {test_state['token']}"}
        response = requests.get(
            f"{BASE_URL}/api/stokvels/{test_state['stokvel_id']}/group-score",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get group score failed: {response.text}"
        data = response.json()
        
        assert "group_score" in data
        assert "tier" in data
        assert "total_pool" in data
        assert "member_count" in data
        assert "avg_member_score" in data
        
        print(f"Group score: {data['group_score']}, Tier: {data['tier']}")
    
    def test_get_my_rewards(self):
        """Test getting user's rewards"""
        headers = {"Authorization": f"Bearer {test_state['token']}"}
        response = requests.get(
            f"{BASE_URL}/api/stokvels/{test_state['stokvel_id']}/my-rewards",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get rewards failed: {response.text}"
        data = response.json()
        
        assert "rewards" in data
        assert "summary" in data
        assert "total_bonus" in data["summary"]
        assert "total_cashback" in data["summary"]
        assert "total_rewards" in data["summary"]
        
        print(f"Total rewards: ${data['summary']['total_rewards']}")


class TestLeaderboards:
    """Leaderboard tests"""
    
    def test_get_user_leaderboard(self):
        """Test getting user leaderboard"""
        headers = {"Authorization": f"Bearer {test_state['token']}"}
        response = requests.get(f"{BASE_URL}/api/leaderboard/users?limit=50", headers=headers)
        
        assert response.status_code == 200, f"Get user leaderboard failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        if len(data) > 0:
            entry = data[0]
            assert "rank" in entry
            assert "user_id" in entry
            assert "username" in entry
            assert "score" in entry
            assert "tier" in entry
        
        print(f"User leaderboard has {len(data)} entries")
    
    def test_get_group_leaderboard(self):
        """Test getting group leaderboard"""
        headers = {"Authorization": f"Bearer {test_state['token']}"}
        response = requests.get(f"{BASE_URL}/api/leaderboard/groups?limit=50", headers=headers)
        
        assert response.status_code == 200, f"Get group leaderboard failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        if len(data) > 0:
            entry = data[0]
            assert "rank" in entry
            assert "stokvel_id" in entry
            assert "name" in entry
            assert "group_score" in entry
            assert "tier" in entry
            assert "total_pool" in entry
            assert "member_count" in entry
        
        print(f"Group leaderboard has {len(data)} entries")


class TestSmartAccess:
    """Smart Access eligibility tests"""
    
    def test_check_smart_access_eligibility(self):
        """Test checking smart access eligibility"""
        headers = {"Authorization": f"Bearer {test_state['token']}"}
        response = requests.get(
            f"{BASE_URL}/api/stokvels/{test_state['stokvel_id']}/smart-access-eligibility",
            headers=headers
        )
        
        assert response.status_code == 200, f"Check eligibility failed: {response.text}"
        data = response.json()
        
        assert "eligible" in data
        assert "user_score" in data
        assert "tier" in data
        assert "total_contributed" in data
        assert "access_percentage" in data
        assert "max_access_amount" in data
        
        print(f"Smart Access eligible: {data['eligible']}, Score: {data['user_score']}")


class TestBadges:
    """Badge system tests"""
    
    def test_get_available_badges(self):
        """Test getting available badges"""
        headers = {"Authorization": f"Bearer {test_state['token']}"}
        response = requests.get(f"{BASE_URL}/api/badges/available", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) > 0
        
        badge = data[0]
        assert "id" in badge
        assert "name" in badge
        assert "description" in badge
        assert "icon" in badge
    
    def test_get_my_badges(self):
        """Test getting user's earned badges"""
        headers = {"Authorization": f"Bearer {test_state['token']}"}
        response = requests.get(f"{BASE_URL}/api/badges/my-badges", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)


class TestPosts:
    """Social feed tests"""
    
    def test_create_post(self):
        """Test creating a post"""
        headers = {"Authorization": f"Bearer {test_state['token']}"}
        response = requests.post(f"{BASE_URL}/api/posts",
            headers=headers,
            json={
                "content": "Test post from automated testing",
                "image": None
            }
        )
        
        assert response.status_code == 200, f"Create post failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert data["content"] == "Test post from automated testing"
        test_state["post_id"] = data["id"]
    
    def test_get_posts(self):
        """Test getting posts feed"""
        headers = {"Authorization": f"Bearer {test_state['token']}"}
        response = requests.get(f"{BASE_URL}/api/posts", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)


class TestDashboard:
    """Dashboard stats tests"""
    
    def test_get_dashboard(self):
        """Test getting dashboard stats"""
        headers = {"Authorization": f"Bearer {test_state['token']}"}
        response = requests.get(f"{BASE_URL}/api/dashboard", headers=headers)
        
        assert response.status_code == 200, f"Get dashboard failed: {response.text}"
        data = response.json()
        
        assert "current_score" in data
        assert "weekly_growth" in data
        assert "rank" in data
        assert "total_posts" in data


class TestNotifications:
    """Notification tests"""
    
    def test_get_notifications(self):
        """Test getting notifications"""
        headers = {"Authorization": f"Bearer {test_state['token']}"}
        response = requests.get(f"{BASE_URL}/api/notifications", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        # Should have notifications from stokvel creation and contribution
        print(f"User has {len(data)} notifications")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
