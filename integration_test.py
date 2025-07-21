import requests
import uuid
import json

# --- Configuration ---
BASE_URL = "http://localhost:3001"

# --- Helper Functions ---


def generate_random_user_data():
    """Generates unique user data for testing."""
    unique_id = uuid.uuid4().hex[:8]  # Short unique ID
    return {
        "email": f"testuser_{unique_id}@example.com",
        # Stronger password with unique part
        "password": f"SecurePass{unique_id}!",
        "name": f"Test User {unique_id}"
    }


def print_step(step_number, message):
    """Prints a formatted step message."""
    print(f"\n--- Step {step_number}: {message} ---")


def assert_response(response, expected_status_code, message="API call"):
    """Asserts the HTTP status code and prints relevant info."""
    print(f"  Response Status: {response.status_code}")
    # Attempt to print JSON body if available, otherwise raw text or 'No Content'
    try:
        response_content = response.json()
    except json.JSONDecodeError:
        response_content = response.text if response.text else 'No Content (Non-JSON)'

    print(f"  Response Body: {response_content}")

    assert response.status_code == expected_status_code, \
        f"{message} FAILED! Expected {expected_status_code}, got {response.status_code}. Body: {response_content}"
    print(f"  {message} SUCCESS!")

# --- Test Flow ---


def run_integration_test_flow():
    print("Starting API Integration Test Flow...")

    # Variables to store data across steps
    user1_data = generate_random_user_data()
    user2_data = generate_random_user_data()
    user1_token = None
    user2_token = None
    todo_uuid = None

    try:
        # 1. Create User 1
        print_step(1, "Creating User 1")
        response = requests.post(f"{BASE_URL}/user", json=user1_data)
        assert_response(response, 201, "User 1 creation")
        assert 'uuid' in response.json(), "User 1 response missing UUID"
        assert response.json()[
            'email'] == user1_data['email'], "User 1 email mismatch"
        print(f"  User 1 UUID: {response.json()['uuid']}")

        # 2. Login User 1
        print_step(2, "Logging in User 1")
        login_payload = {
            "email": user1_data["email"], "password": user1_data["password"]}
        response = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
        assert_response(response, 200, "User 1 login")
        assert 'accessToken' in response.json(), "Login response missing accessToken"
        user1_token = response.json()['accessToken']
        print("  User 1 logged in successfully.")

        # 3. Create Todo by User 1
        print_step(3, "Creating a Todo by User 1")
        create_todo_payload = {
            "name": "My First Collaborative Todo",
            "description": "This is a description for my first todo."
        }
        headers = {"Authorization": f"Bearer {user1_token}"}
        response = requests.post(
            f"{BASE_URL}/todo", json=create_todo_payload, headers=headers)
        assert_response(response, 201, "Todo creation")
        assert 'uuid' in response.json(), "Todo response missing UUID"
        assert response.json()[
            'name'] == create_todo_payload['name'], "Todo name mismatch"
        todo_uuid = response.json()['uuid']
        print(f"  Todo UUID: {todo_uuid}")

        # 4. Update Todo by User 1
        print_step(4, "Updating the Todo by User 1")
        update_todo_payload = {
            "name": "My First Collaborative Todo (Updated)",
            "description": "The description has been updated.",
            "status": "IN_PROGRESS",
            "priority": "HIGH"
        }
        response = requests.patch(
            f"{BASE_URL}/todo/{todo_uuid}", json=update_todo_payload, headers=headers)
        assert_response(response, 200, "Todo update")

        # Verify update by fetching the todo
        response = requests.get(
            f"{BASE_URL}/todo/{todo_uuid}", headers=headers)
        assert_response(response, 200, "Fetch updated Todo")
        assert response.json()[
            'name'] == update_todo_payload['name'], "Updated todo name mismatch"
        assert response.json()[
            'description'] == update_todo_payload['description'], "Updated todo description mismatch"
        assert response.json()[
            'status'] == update_todo_payload['status'], "Updated todo status mismatch"
        assert response.json()[
            'priority'] == update_todo_payload['priority'], "Updated todo priority mismatch"
        print("  Todo verified as updated.")

        # 5. Create Another User (User 2)
        print_step(5, "Creating another user (User 2)")
        response = requests.post(f"{BASE_URL}/user", json=user2_data)
        assert_response(response, 201, "User 2 creation")
        assert 'uuid' in response.json(), "User 2 response missing UUID"
        assert response.json()[
            'email'] == user2_data['email'], "User 2 email mismatch"
        print(f"  User 2 UUID: {response.json()['uuid']}")

        # Login User 2 to get their token
        print_step("5.1", "Logging in User 2")
        login_payload_2 = {
            "email": user2_data["email"], "password": user2_data["password"]}
        response = requests.post(
            f"{BASE_URL}/auth/login", json=login_payload_2)
        assert_response(response, 200, "User 2 login")
        assert 'accessToken' in response.json(), "User 2 login response missing accessToken"
        user2_token = response.json()['accessToken']
        print("  User 2 logged in successfully.")

        # 6. Invite User 2 to the Todo (by User 1)
        print_step(6, "Inviting User 2 to the Todo by User 1")
        # CORRECTED PAYLOAD: API expects 'email' and 'role'
        invite_payload = {
            # Changed from invitedUserEmail to email
            "email": user2_data["email"],
            "role": "VIEWER"  # Added the required role field
        }
        response = requests.post(
            f"{BASE_URL}/todo/{todo_uuid}/invite", json=invite_payload, headers=headers)
        assert_response(response, 201, "User 2 invite to todo")
        print("  User 2 invited successfully.")

        # Verify User 2's role (should be VIEWER by default)
        print_step("6.1", "Verifying User 2's role for the Todo")
        user2_headers = {"Authorization": f"Bearer {user2_token}"}
        response = requests.get(
            f"{BASE_URL}/todo/{todo_uuid}/user-role", headers=user2_headers)
        assert_response(response, 200, "Get User 2 role")
        assert response.json()[
            'role'] == 'VIEWER', "User 2 role mismatch (expected VIEWER)"
        print(f"  User 2's role for todo {todo_uuid} is confirmed as VIEWER.")

        # Test User 2 (VIEWER) can view the todo
        print_step("7", "User 2 (VIEWER) views the todo")
        response = requests.get(
            f"{BASE_URL}/todo/{todo_uuid}", headers=user2_headers)
        assert_response(response, 200, "User 2 views todo")
        assert response.json()[
            'uuid'] == todo_uuid, "User 2 view todo UUID mismatch"
        print("  User 2 successfully viewed the todo.")

        # Test User 2 (VIEWER) cannot update the todo
        print_step(
            "8", "User 2 (VIEWER) attempts to update the todo (should fail)")
        attempt_update_payload = {"description": "Attempted update by viewer"}
        response = requests.patch(
            f"{BASE_URL}/todo/{todo_uuid}", json=attempt_update_payload, headers=user2_headers)
        # Expect Forbidden
        assert_response(response, 403, "User 2 (VIEWER) update attempt")
        print("  User 2 (VIEWER) correctly denied update access.")

        # Update User 2's role to EDITOR by User 1
        print_step("9", "Updating User 2's role to EDITOR by User 1")
        # CORRECTED PAYLOAD for /todo/{uuid}/role: API expects 'email' and 'role'
        update_role_payload = {
            "email": user2_data["email"],  # Changed from userEmail to email
            "role": "EDITOR"  # Changed from newRole to role
        }
        response = requests.patch(
            f"{BASE_URL}/todo/{todo_uuid}/role", json=update_role_payload, headers=headers)
        assert_response(response, 200, "User 2 role update to EDITOR")
        print("  User 2's role updated to EDITOR.")

        # Verify User 2's role is now EDITOR
        print_step("9.1", "Verifying User 2's role is now EDITOR")
        response = requests.get(
            f"{BASE_URL}/todo/{todo_uuid}/user-role", headers=user2_headers)
        assert_response(response, 200, "Get User 2 updated role")
        assert response.json()[
            'role'] == 'EDITOR', "User 2 role mismatch (expected EDITOR)"
        print(f"  User 2's role for todo {todo_uuid} is confirmed as EDITOR.")

        # Test User 2 (EDITOR) can update the todo
        print_step("10", "User 2 (EDITOR) updates the todo")
        editor_update_payload = {"description": "Updated by the new editor!"}
        response = requests.patch(
            f"{BASE_URL}/todo/{todo_uuid}", json=editor_update_payload, headers=user2_headers)
        assert_response(response, 200, "User 2 (EDITOR) update todo")

        # Verify update by fetching the todo by User 1
        response = requests.get(
            f"{BASE_URL}/todo/{todo_uuid}", headers=headers)
        assert_response(
            response, 200, "User 1 fetches todo after editor update")
        assert response.json()[
            'description'] == editor_update_payload['description'], "Editor update description mismatch"
        print("  Todo successfully updated by new editor.")

        # Remove User 2 from the Todo by User 1
        print_step("11", "Removing User 2 from the Todo by User 1")
        # CORRECTED PAYLOAD for /todo/{uuid}/user-permission: API expects 'email'
        # Changed from userEmail to email
        remove_user_payload = {"email": user2_data["email"]}
        response = requests.delete(
            f"{BASE_URL}/todo/{todo_uuid}/user-permission", json=remove_user_payload, headers=headers)
        # Or 204 No Content
        assert_response(response, 200, "User 2 removal from todo")

        # Verify User 2 can no longer access the todo (should be 403 Forbidden)
        print_step("11.1", "Verifying User 2 cannot access todo after removal")
        response = requests.get(
            f"{BASE_URL}/todo/{todo_uuid}/user-role", headers=user2_headers)
        # Expect Forbidden
        assert_response(response, 403, "User 2 access after removal")
        print("  User 2 correctly denied access after removal.")

        # Soft Delete Todo by User 1
        print_step("12", "Soft deleting the Todo by User 1")
        response = requests.delete(
            f"{BASE_URL}/todo/{todo_uuid}", headers=headers)
        assert_response(response, 204, "No Content")

        # Verify todo is no longer accessible
        print_step(
            "12.1", "Verifying todo is no longer accessible after soft delete")
        response = requests.get(
            f"{BASE_URL}/todo/{todo_uuid}", headers=headers)
        # Expect Not Found
        assert_response(response, 404, "Access deleted todo")
        print("  Todo successfully soft-deleted and is inaccessible.")

    except AssertionError as e:
        print(f"\n!!! TEST FAILED: {e}")
    except requests.exceptions.ConnectionError as e:
        print(
            f"\n!!! CONNECTION ERROR: Ensure your NestJS server is running at {BASE_URL}. Error: {e}")
    except Exception as e:
        print(f"\n!!! AN UNEXPECTED ERROR OCCURRED: {e}")
    finally:
        print("\n--- Test Flow Completed ---")


if __name__ == "__main__":
    run_integration_test_flow()
