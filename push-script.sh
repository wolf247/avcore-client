#!/bin/bash
chmod +x ./push-script.sh


elements=("src/" "client/src/" "push-script.sh" "**/package-lock.json" "**/test.ts" "**/tsconfig.json" "**/webpack.config.js")

tmpDir=$(mktemp -d /tmp/git-copy-XXXXXX)
cd ${tmpDir}

# from
git clone git@github.com:anovikov1984/avcore.git .
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

rm -rf "${tmpDir}"