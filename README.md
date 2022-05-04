## Unmaintained
This early experiment is now closed, as it is no longer up to date with developments at https://imba.io/

# esimba
Fast bundler for Imba

## Internal notes

### test esbuild with plugins

Create two subdirectories. One to compile esbuild with plugins enabled, and the other to transpile a sample imba application.

```shell
mkdir esbuild
mkdir sample

cd esbuild
npx degit evanw/esbuild#plugins
make platform-neutral
cd npm/esbuild
npm install
cp ../../esbuild bin
rm install.js
touch install.js
npm link
cd ../../..

cd sample
mkdir src
mkdir dist
echo console.log('Imba is magic') > src/sample.imba
npm init -y
npm link esbuild
npx esimba prod sample.imba
node dist/sample.js
cd ..
```
