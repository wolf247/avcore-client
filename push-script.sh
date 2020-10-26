#!/bin/bash


elements=("src/" "client/src/" "push-script.sh" "package-lock.json" "test.ts" "tsconfig.json" "webpack.config.js" "**/package-lock.json" "**/test.ts" "**/tsconfig.json" "**/webpack.config.js")

tmpDir=$(mktemp -d /tmp/git-copy-XXXXXX)
cd ${tmpDir}

# from
git clone git@github.com:anovikov1984/avcore.git 
cd avcore

# update version
VERSION=$(npm view avcore version)
IFS="." read -ra NUMS <<< "$VERSION"
((NUMS[2]++))

UPD_VER=$( IFS=$'.'; echo "${NUMS[*]}" )
npm version $UPD_VER
# 

git checkout -b temp

for var in "${elements[@]}"
do
  echo $var >> .gitignore
  git rm --cached $var -r
done

# to
git remote add tempremote git@github.com:codeda/avcore-client.git
git add .
git commit -m 'remote commit'
git push -u tempremote +temp:main

git checkout master
git branch -D temp
git remote rm tempremote

cd ..

# publish
git clone git@github.com:codeda/avcore-client.git
cd avcore-client

npm publish

rm -rf "${tmpDir}"