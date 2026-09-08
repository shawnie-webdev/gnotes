#!/bin/bash

# Target folder to monitor
TARGET_DIR="/gnotes"

# Ensure the system has fully loaded network and SSH targets before running
sleep 15

# Loop infinitely to back up your code continuously in the background
while true; do
    if [ -d "$TARGET_DIR/.git" ]; then
        cd "$TARGET_DIR" || exit

        # Tell Git specifically where to find your private SSH key
        export GIT_SSH_COMMAND="ssh -i /home/roshan/.ssh/id_ed25519 -o StrictHostKeyChecking=accept-new"

        # Check if there are changes to push
        if [[ -n $(git status --porcelain) ]]; then
            git add .
            git commit -m "Automated backup: $(date)"
            git push origin main
        fi
    fi
    # Wait 5 minutes (300 seconds) before checking for modifications again
    sleep 300
done
