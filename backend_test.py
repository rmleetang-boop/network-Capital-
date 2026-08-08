import requests
import sys
import json
from datetime import datetime
import time

class NetworkCapitalAPITester:
    def __init__(self, base_url="https://mongo-dump-viewer.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_users = []
        self.test_posts = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Response text: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_signup(self, email, password, username, bio="Test user bio"):
        """Test user signup"""
        success, response = self.run_test(
            "User Signup",
            "POST",
            "auth/signup",
            200,
            data={
                "email": email,
                "password": password,
                "username": username,
                "bio": bio
            }
        )
        if success and 'token' in response:
            user_data = {
                'token': response['token'],
                'user': response['user'],
                'email': email,
                'password': password
            }
            self.test_users.append(user_data)
            return user_data
        return None

    def test_login(self, email, password):
        """Test user login"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            return response['user']
        return None

    def test_get_me(self):
        """Test get current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "users/me",
            200
        )
        return response if success else None

    def test_update_profile(self, username=None, bio=None, photo=None):
        """Test profile update"""
        update_data = {}
        if username:
            update_data["username"] = username
        if bio:
            update_data["bio"] = bio
        if photo:
            update_data["photo"] = photo
            
        success, response = self.run_test(
            "Update Profile",
            "PUT",
            "users/me",
            200,
            data=update_data
        )
        return response if success else None

    def test_get_user(self, user_id):
        """Test get user by ID"""
        success, response = self.run_test(
            "Get User by ID",
            "GET",
            f"users/{user_id}",
            200
        )
        return response if success else None

    def test_create_post(self, content, image=None):
        """Test create post"""
        post_data = {"content": content}
        if image:
            post_data["image"] = image
            
        success, response = self.run_test(
            "Create Post",
            "POST",
            "posts",
            200,
            data=post_data
        )
        if success and 'id' in response:
            self.test_posts.append(response['id'])
            return response
        return None

    def test_get_posts(self):
        """Test get posts"""
        success, response = self.run_test(
            "Get Posts",
            "GET",
            "posts",
            200
        )
        return response if success else None

    def test_like_post(self, post_id):
        """Test like post"""
        success, response = self.run_test(
            "Like Post",
            "POST",
            f"posts/{post_id}/like",
            200
        )
        return response if success else None

    def test_comment_post(self, post_id, content):
        """Test comment on post"""
        success, response = self.run_test(
            "Comment on Post",
            "POST",
            f"posts/{post_id}/comment",
            200,
            data={"content": content}
        )
        return response if success else None

    def test_share_post(self, post_id):
        """Test share post"""
        success, response = self.run_test(
            "Share Post",
            "POST",
            f"posts/{post_id}/share",
            200
        )
        return response if success else None

    def test_get_leaderboard(self):
        """Test get leaderboard"""
        success, response = self.run_test(
            "Get Leaderboard",
            "GET",
            "leaderboard",
            200
        )
        return response if success else None

    def test_get_notifications(self):
        """Test get notifications"""
        success, response = self.run_test(
            "Get Notifications",
            "GET",
            "notifications",
            200
        )
        return response if success else None

    def test_get_dashboard(self):
        """Test get dashboard"""
        success, response = self.run_test(
            "Get Dashboard",
            "GET",
            "dashboard",
            200
        )
        return response if success else None

    def test_referral_system(self, referral_code):
        """Test referral system"""
        success, response = self.run_test(
            "Use Referral Code",
            "POST",
            f"referral/{referral_code}",
            200
        )
        return response if success else None

def main():
    print("🚀 Starting Network Capital API Tests")
    print("=" * 50)
    
    tester = NetworkCapitalAPITester()
    timestamp = datetime.now().strftime('%H%M%S')
    
    # Test 1: Create multiple test users
    print("\n📝 TESTING USER REGISTRATION & AUTHENTICATION")
    user1 = tester.test_signup(
        f"testuser1_{timestamp}@example.com",
        "TestPass123!",
        f"testuser1_{timestamp}",
        "I'm a test user for Network Capital"
    )
    
    user2 = tester.test_signup(
        f"testuser2_{timestamp}@example.com", 
        "TestPass123!",
        f"testuser2_{timestamp}",
        "Another test user"
    )
    
    user3 = tester.test_signup(
        f"testuser3_{timestamp}@example.com",
        "TestPass123!", 
        f"testuser3_{timestamp}",
        "Third test user"
    )

    if not user1:
        print("❌ User registration failed, stopping tests")
        return 1

    # Test 2: Login with first user
    login_result = tester.test_login(user1['email'], user1['password'])
    if not login_result:
        print("❌ Login failed, stopping tests")
        return 1

    # Test 3: Get current user
    current_user = tester.test_get_me()
    if not current_user:
        print("❌ Get current user failed")
        return 1

    # Test 4: Update profile
    updated_profile = tester.test_update_profile(
        bio="Updated bio for testing",
        photo="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
    )

    # Test 5: Get user by ID
    user_by_id = tester.test_get_user(current_user['id'])

    print("\n📱 TESTING POSTS & SOCIAL FEATURES")
    
    # Test 6: Create posts
    post1 = tester.test_create_post("This is my first test post! #NetworkCapital")
    post2 = tester.test_create_post(
        "Second post with image", 
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
    )

    if not post1:
        print("❌ Post creation failed")
        return 1

    # Test 7: Get posts
    posts = tester.test_get_posts()
    if not posts:
        print("❌ Get posts failed")
        return 1

    # Test 8: Social interactions with second user
    if user2:
        # Login as second user
        tester.test_login(user2['email'], user2['password'])
        
        # Like the first post
        if post1:
            like_result = tester.test_like_post(post1['id'])
            
        # Comment on the first post
        if post1:
            comment_result = tester.test_comment_post(post1['id'], "Great post!")
            
        # Share the first post
        if post1:
            share_result = tester.test_share_post(post1['id'])

    # Test 9: Switch back to first user and test other features
    tester.test_login(user1['email'], user1['password'])

    print("\n🏆 TESTING LEADERBOARD & GAMIFICATION")
    
    # Test 10: Get leaderboard
    leaderboard = tester.test_get_leaderboard()

    # Test 11: Get notifications
    notifications = tester.test_get_notifications()

    # Test 12: Get dashboard
    dashboard = tester.test_get_dashboard()

    print("\n🔗 TESTING REFERRAL SYSTEM")
    
    # Test 13: Referral system (if we have referral codes)
    if user3 and current_user and 'referral_code' in current_user:
        # Login as third user
        tester.test_login(user3['email'], user3['password'])
        referral_result = tester.test_referral_system(current_user['referral_code'])

    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 FINAL TEST RESULTS")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())