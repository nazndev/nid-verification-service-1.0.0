#!/bin/bash

echo " Installing Node Version Manager (nvm) and Node.js 18..."

# Install nvm
echo "Installing nvm..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Install Node.js 18
echo "Installing Node.js 18 LTS..."
nvm install 18
nvm use 18
nvm alias default 18

# Verify installation
echo "Verifying installation..."
node --version
npm --version

echo " Node.js 18 LTS installed successfully via nvm!"
echo "Now you can run: npm run dev" 