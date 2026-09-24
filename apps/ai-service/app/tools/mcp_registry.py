USER_MCP_TOOLS = [
    {
        "name": "lookup_user",
        "description": "Find an existing user by their full name or email address.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "identifier": {"type": "string", "description": "User's full name or email"}
            },
            "required": ["identifier"]
        }
    },
    {
        "name": "create_user",
        "description": "Create a new user. Name, email, and role are strictly required.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "email": {"type": "string", "format": "email"},
                "role": {"type": "string"}
            },
            "required": ["name", "email", "role"]
        }
    },
    {
        "name": "update_user",
        "description": "Update existing user attributes. Accepts user ID and fields to modify.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "user_id": {"type": "string"},
                "name": {"type": "string"},
                "email": {"type": "string"},
                "role": {"type": "string"}
            },
            "required": ["user_id"]
        }
    },
    {
        "name": "delete_user",
        "description": "Deletes an existing user by user ID. ONLY call this when confirmation is given.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "user_id": {"type": "string"}
            },
            "required": ["user_id"]
        }
    }
]