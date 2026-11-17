import os
import sys
import google.generativeai as genai

prompt = sys.argv[1]
genai.configure(api_key=os.environ["GEMINI_API_KEY"])

# Using the exact skill instructions we discussed earlier
system_instruction = """You are the cartoon-3d-short skill agent. 
Write a 55-70s script and the Remotion story.ts camera plan for the user's topic. 
Output EXACTLY two sections separated by '---CODE_SPLIT---'. 
Section 1: The SCRIPT.txt text. 
Section 2: The raw TypeScript code for story.ts."""

model = genai.GenerativeModel(
    model_name="gemini-2.5-pro",
    system_instruction=system_instruction
)

print(f"Generating video files for: {prompt}")
response = model.generate_content(prompt)
parts = response.text.split('---CODE_SPLIT---')

if len(parts) == 2:
    # Create the project folder
    os.makedirs("src/videos/generated", exist_ok=True)
    
    with open("src/videos/generated/SCRIPT.txt", "w") as f:
        f.write(parts[0].strip())
        
    with open("src/videos/generated/story.ts", "w") as f:
        f.write(parts[1].strip())
        
    print("Files successfully generated!")
else:
    print("Error: Gemini output format invalid.")
    sys.exit(1)
