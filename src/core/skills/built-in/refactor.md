# Refactor Skill

Refactor code to improve quality, readability, and maintainability.

## Trigger
- command: /refactor

## Variables
- file_path: The file to refactor
- goals: Refactoring goals (readability, performance, modularity)

## Steps
1. Read the target file
   - tool: Read
   - params: { "file_path": "${file_path}" }

2. Analyze and plan refactoring
   - prompt: Analyze the code from the previous step and create a refactoring plan. Goals: ${goals}. Consider:
     - Code duplication
     - Complex functions that should be split
     - Poor naming conventions
     - Missing abstractions
     - Violations of SOLID principles
     List specific changes to make.

3. Apply refactoring
   - prompt: Apply the refactoring changes planned in the previous step to the code. Maintain the same functionality while improving code quality.

## On Error
- stop
