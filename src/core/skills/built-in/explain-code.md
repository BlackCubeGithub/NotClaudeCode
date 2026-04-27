# Explain Code Skill

Explain code in detail, breaking down complex logic and patterns.

## Trigger
- command: /explain

## Variables
- file_path: The file to explain
- detail_level: Level of detail (brief, normal, detailed)

## Steps
1. Read the target file
   - tool: Read
   - params: { "file_path": "${file_path}" }

2. Generate explanation
   - prompt: Explain the code from the previous step with ${detail_level} detail level. Include:
     - Overall purpose and structure
     - Key functions and their responsibilities
     - Important patterns or algorithms used
     - Dependencies and how they're used
     - Any potential improvements or issues

## On Error
- stop
