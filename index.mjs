#!/usr/bin/env zx
$.verbose = false

const archs = ['arm64_v8a', 'armeabi_v7a', 'x86_64', 'x86']

const exitWithErorr = (errMsg) => {
  console.error(chalk.red(errMsg))
  process.exit(1)
}

const lang = 'en'
const dpi = 'xxhdpi'
const baseURL = 'https://aliucord.com/download/discord?v=%VERSION%'
const splitURL = '&split=config.%SPLIT%'

let { stdout: arch } = await $`adb shell getprop ro.product.cpu.abi`
arch = arch.replace(/-/g, '_').replace(/\n/g, '')

if (!archs.includes(arch)) exitWithErorr(`Unsupported arch: ${arch}`)

let ver = argv.ver
if (!argv.ver) exitWithErorr('Error: You must specify the --ver argument')
if (isNaN(argv.ver)) exitWithErorr('Error: The --ver argument must be a number')

let { stdout: code } = await $`curl -s -o /dev/null -I -w "%{http_code}" ${baseURL.replace('%VERSION%', ver)}`
if (parseInt(code) === 404) exitWithErorr(`Error: Version ${ver} not found`)

const baseDir = '/data/local/tmp/'
const installDirName = 'installTemp/'

await $`adb shell mkdir -p ${baseDir + installDirName}/${ver}`

const getApkSize = async (name, type) => {
  let awk
  if (type === 'config') {
    awk = await $`ls -l ${ver}/${ver}_config.${name}.apk | awk '{print $5}'`
  } else {
    awk = await $`ls -l ${ver}/${ver}_${name}.apk | awk '{print $5}'`
  }
  return parseInt(awk.stdout)
}

const downloadApk = async (split, type) => {
  if (type === 'config') {
    await $`curl -L -s --create-dirs -o ${ver}/${ver}_config.${split}.apk ${baseURL.replace('%VERSION%', ver) + splitURL.replace('%SPLIT%', split)}`
  } else {
    await $`curl -L -s --create-dirs -o ${ver}/${ver}_${split}.apk ${baseURL.replace('%VERSION%', ver)}`
  }
}

await downloadApk('base', 'base')
let base_size = await getApkSize('base', 'base')
console.log(`Downloaded base apk (${base_size} bytes)`)

await downloadApk(arch, 'config')
let arch_size = await getApkSize(arch, 'config')
console.log(`Downloaded arch apk (${arch_size} bytes)`)

await downloadApk(dpi, 'config')
let dpi_size = await getApkSize(dpi, 'config')
console.log(`Downloaded dpi apk (${dpi_size} bytes)`)

await downloadApk(lang, 'config')
let lang_size = await getApkSize(lang, 'config')
console.log(`Downloaded lang apk (${lang_size} bytes)`)

let total_size = base_size + arch_size + dpi_size + lang_size
console.log(`Total size: ${total_size} bytes`)

let installAPKs = `sessionId=$(pm install-create -S ${total_size} | grep -Eo '[0-9]+[0-9]+')
for apk in ${baseDir + installDirName + ver}/*.apk
do
  size=$(ls -l $apk | awk '{print $5}')
  name=$(basename $apk .apk)
  pm install-write -S $size $sessionId $name $apk
done
pm install-commit $sessionId`

await $`echo ${installAPKs}`
  .pipe(fs.createWriteStream(`${ver}/install.sh`))

let { stdout: push } = await $`adb push ${ver}/. ${baseDir + installDirName + ver}`
console.log(push)

console.log(`Installing ${ver}`)
await $`adb shell chmod +x ${baseDir + installDirName + ver}/install.sh && adb shell ${baseDir + installDirName + ver}/install.sh`
console.log(chalk.green(`Discord Alpha ${ver} was successfully installed!`))

console.log('Starting clean up...')
await $`rm -rf ${ver}`
await $`adb shell rm -rf ${baseDir + installDirName}`
console.log(chalk.green('Clean up complete!'))
