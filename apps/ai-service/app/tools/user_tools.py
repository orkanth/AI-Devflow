from typing import Optional
from langchain_core.tools import tool
from app.clients.user_client import users_client 

# ==========================================
# 1. USER MANAGEMENT TOOLS
# ==========================================

# To get the user details, we can use the NestJS API to fetch user information by their name or email address. This tool will return a formatted string with the user's profile details.
@tool
async def lookup_user_tool(identifier: str) -> str:
    """Finds an existing user by their name or email address and returns their profile details.
    
    Args:
        identifier: The target user's current name or email (e.g., 'Ravi', 'revavi', 'orkanth@yopmail.com').
    """
    clean_identifier = identifier.strip().strip('"').strip("'")
    
    user = await users_client.find_user(clean_identifier)
    if not user:
        return f"A user with the identifier <b>{clean_identifier}</b> was not found."

    user_id = user.get("id", "N/A")
    name = user.get("name", "N/A")
    email = user.get("email", "N/A")
    role = user.get("role", "N/A")

    return (
        f"User details for <b>{name}</b>:<br/>"
        f"• <b>ID:</b> {user_id}<br/>"
        f"• <b>Name:</b> {name}<br/>"
        f"• <b>Email:</b> {email}<br/>"
        f"• <b>Role:</b> {role}"
    )
    
# Create a new user in the system. This tool will call the NestJS API to create a user with the provided name, email, and role. It will return a confirmation message or an error if the user already exists.    
@tool
async def create_user_tool(name: str, email: str, role: str) -> str:
    """Creates a user. Returns confirmation message or duplicate validation error."""
    result = await users_client.create_user(name=name, email=email, role=role)
    if not result.get("success"):
        return result.get("error", "Failed to create user.")
    return f"User {name} with role {role} and email {email} was created successfully."

#update user by identifier (name or email) tool
@tool
async def update_user_tool(
    identifier: str,
    name: Optional[str] = None,
    email: Optional[str] = None,
    role: Optional[str] = None,
) -> str:
    """Updates an existing user identified by their current name OR current email address.
    print(f"\n>>> [TOOL CALLED] update_user_tool with: identifier='{identifier}', name='{name}', email='{email}', role='{role}'")
    Args:
        identifier: The target user's existing name OR email address (e.g. 'revavi', 'Ravi', 'orkanth@yop.com'). Do NOT ask for a numeric or UUID user_id.
        name: The new name to set (optional).
        email: The new email to set (optional).
        role: The new role to set (optional, e.g. 'Manager', 'Admin', 'Developer').
    """
    payload = {k: v for k, v in {"name": name, "email": email, "role": role}.items() if v is not None}
    if not payload:
        return "No fields provided to update. Please specify what you want to change (name, email, or role)."

    # Call NestJS update by identifier (resolves either email or name)
    result = await users_client.update_user_by_identifier(
        identifier=identifier,
        name=name,
        email=email,
        role=role,
    )
    
    if not result.get("success"):
        return result.get("error", "Failed to update user.")

    updated = result.get("data", {})
    return (
        f"User <b>{identifier}</b> updated successfully: "
        f"Name: <b>{updated.get('name')}</b>, "
        f"Email: <b>{updated.get('email')}</b>, "
        f"Role: <b>{updated.get('role')}</b>."
    )
    
       
# Delete a user by their name or email address. This tool will call the NestJS API to delete the user and return a confirmation message or an error if the user does not exist.
@tool 
async def delete_user_tool(
    identifier: str,
    email: Optional[str] = None
) -> str:
    """Permanently deletes a single user from the system by their name or email address."""
    clean_identifier = identifier.strip().strip('"\'') if identifier else ""
    clean_email = email.strip().strip('"\'') if email else ""

    primary_target = clean_email or clean_identifier
    if not primary_target:
        return "Error: No valid identifier or email provided."

    result = await users_client.delete_by_identifier(primary_target)

    # Fallback to name if email was not found
    if not result.get("success") and clean_email and clean_identifier and clean_email != clean_identifier:
        result = await users_client.delete_by_identifier(clean_identifier)

    if not result.get("success"):
        return f"Error: {result.get('error', 'User could not be deleted.')}"

    data = result.get("data", {})
    name = data.get("name") or primary_target

    return f"User <b>{name}</b> has been deleted successfully."