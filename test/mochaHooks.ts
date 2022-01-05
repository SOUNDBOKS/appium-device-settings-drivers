import { Brand, ISettingsDriver, WebdriverBrowser } from "../src/lib/types"
import { createSettingsDriver } from "../src/lib"

import * as WebdriverIO from "webdriverio"
import * as fs from "fs/promises"
import { PhoneDriver } from "../src/lib/PhoneDriver"

type Pod = {
    udid: string;
    deviceName: string;
    brand: Brand,
    platformVersion: string;
    testDevice: string;
}

export let client: WebdriverBrowser;
export let driver: ISettingsDriver;
export let pod: Pod;

let phoneDriver: PhoneDriver;

const automationName = {
    'Android': 'UiAutomator2',
    'iOS': 'XCuiTest'
};


export const mochaHooks = {
    async beforeAll() {
        pod = JSON.parse(await fs.readFile("output/pod.json", { encoding: "utf-8" }))
        const platformName = pod.brand === Brand.iPhone ? "iOS" : "Android";

        client = await WebdriverIO.remote({
            logLevel: "warn",
            path: "/",
            port: 7200,
            capabilities: {
                platformName,
                "appium:wdaLocalPort": 8000,
                "appium:systemPort": 8000,
                "appium:automationName": automationName[platformName],
                "appium:deviceName": pod.deviceName,
                "appium:platformVersion": pod.platformVersion,
                "appium:udid": pod.udid,
                "appium:autoAcceptAlerts": false,
                "appium:autoGrantPermissions": false,
                "appium:language": "en",
                "appium:locale": "US",
                "appium:locationServicesEnabled": true,
            }
        } as any)

        driver = createSettingsDriver(client, pod.brand, pod.platformVersion)
        phoneDriver = driver as any as PhoneDriver
    },
    async beforeEach() {
    },
    async afterEach() {
        await phoneDriver.printScreen()
    },
    async afterAll() {
        await phoneDriver.client.deleteSession()
    }
}
