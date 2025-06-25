#!/bin/bash

echo "Updating Node.js to version 18 LTS..."

# Remove old Node.js if exists
if command -v node &> /dev/null; then
    echo "Removing existing Node.js installation..."
    sudo apt-get remove -y nodejs npm
    sudo apt-get autoremove -y
fi

# Add NodeSource repository for Node.js 18
echo "Adding NodeSource repository..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js 18
echo "Installing Node.js 18..."
sudo apt-get install -y nodejs

# Verify installation
echo "Verifying installation..."
node --version
npm --version

echo "Node.js 18 LTS installed successfully!"
echo "Now you can run: npm run dev" 