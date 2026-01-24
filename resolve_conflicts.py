import sys
import re

def resolve_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Regex to match conflict blocks
        # <<<<<<< Updated upstream
        # CONTENT_UPSTREAM
        # =======
        # CONTENT_STASHED
        # >>>>>>> Stashed changes
        
        # We want to keep CONTENT_UPSTREAM
        
        pattern = re.compile(r'<<<<<<< Updated upstream\n(.*?)\n=======\n.*?\n>>>>>>> Stashed changes', re.DOTALL)
        
        # Function to replace with group 1
        def replacer(match):
            return match.group(1)
            
        new_content = pattern.sub(replacer, content)
        
        if new_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Resolved conflicts in {filepath}")
        else:
            print(f"No conflicts found in {filepath} (or pattern didn't match)")
            
    except Exception as e:
        print(f"Error processing {filepath}: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        resolve_file(sys.argv[1])
