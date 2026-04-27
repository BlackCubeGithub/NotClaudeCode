# Code Review Skill

Automatically review code for quality, security, and best practices.

## Trigger
- command: /review

## Variables
- file_path: The file or directory to review
- focus: Focus area (security, performance, style, all)

## Steps
1. Read the target file(s)
   - tool: Read
   - params: { "file_path": "${file_path}" }

2. Analyze code for issues
   - prompt: Review the code from the previous step. Focus on: ${focus}. Check for:
     - Security vulnerabilities (SQL injection, XSS, etc.)
     - Performance issues
     - Code style and best practices
     - Potential bugs
     - Missing error handling
     Provide specific, actionable feedback.

## On Error
- continue
