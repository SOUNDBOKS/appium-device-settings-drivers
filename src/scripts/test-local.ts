

import { Option, program } from "commander"
import { Brand } from "../lib/types"
import * as Appium from "./lib/appium"
import { Writable } from "stream"
import Logger from "@soundboks/async-logger"
import { spawn } from "child_process"
import * as fs from "fs"
import { promisify } from "util"

const mkdir = promisify(fs.mkdir)

program.addOption(new Option("--udid <udid>").makeOptionMandatory())
program.addOption(new Option("--deviceName <deviceName>"))
program.addOption(new Option("--brand <brand>").choices(Object.keys(Brand)).makeOptionMandatory())
program.addOption(new Option("--osVersion <version>").makeOptionMandatory())
program.addOption(new Option("--testDevice <device>").makeOptionMandatory())
program.argument("<test-file>", "Path to the test")

program.parse()

const options = program.opts()
const main = async () => {
    await mkdir("output/", { recursive: true })

    fs.writeFileSync("output/pod.json", JSON.stringify({
        udid: options.udid,
        brand: options.brand,
        osVersion: options.osVersion,
        testDevice: options.testDevice,
        deviceName: options.deviceName,
    }, undefined, 2))
    
    let appium: Appium.AppiumProcess
    try {
        appium = Appium.startServer("output/appium.log", 7200)
        Logger.log("Appium Server started")

        await new Promise(resolve => setTimeout(resolve, 3000))
        const mochaCmd = "TS_NODE_FILES=true POD=output/pod.json yarn mocha --require ts-node/register --require test/mochaHooks.ts --spec " + program.processedArgs[0]
        const mochaExitCode = await runCommand(mochaCmd)

        return mochaExitCode
    } finally {
        await Appium.stopServer(appium!)
        Logger.log("Appium Server stopped")
    }
}

export const runCommand = async (cmd: string, throwOnError = true): Promise<number> => {
    // Note: using spawn instead of execSync because otherwise Appium event loop will pause
    console.log(`Running "${cmd}"`);

    const tapStream = new Writable({
        write: (data, encoding, callback) => {
            Logger.log(data)
            callback(null)
        }
    })
    const process = spawn(cmd, { stdio: "pipe", shell: true });
    process.stdout.pipe(tapStream)
    process.stderr.pipe(tapStream)
    const exitCode = await new Promise((resolve) => process.on('exit', resolve));

    if (exitCode !== 0) {
        Logger.log(`Exit code of "${cmd}": ${exitCode}`);
        if (throwOnError) {
            throw new Error(`Failed to run "${cmd}"`);
        }
    }
    return exitCode as number;
}




main().then(process.exit, e => {
    console.error(e)
    process.exit(-1)
})
