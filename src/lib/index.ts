
import { coerce } from "semver"
import HuaweiSettingsDriver from "./drivers/HuaweiSettingsDriver"
import iOSSettingsDriver from "./drivers/iOSSettingsDriver"
import LGSettingsDriver from "./drivers/LGSettingsDriver"
import OnePlusSettingsDriver from "./drivers/OnePlusSettingsDriver"
import SamsungSettingsDriver from "./drivers/SamsungSettingsDriver"
import StockAndroidSettingsDriver from "./drivers/StockAndroidSettingsDriver"
import { WebdriverBrowser, Brand, ISettingsDriver } from "./types"



export function createSettingsDriver(
    client: WebdriverBrowser,    
    brand: Brand,
    platformVersion: string,
): ISettingsDriver {
    const semver = coerce(platformVersion) || (() => { throw new Error("Passed platform version could not be coerced into a semver") })()

    switch(brand) {
        case Brand.iPhone:
            return new iOSSettingsDriver(client)
        case Brand.LG:
            return new LGSettingsDriver(client)
        case Brand.OnePlus:
            return new OnePlusSettingsDriver(client, semver)
        case Brand.Huawei:
            return new HuaweiSettingsDriver(client, semver)
        case Brand.Samsung:
            return new SamsungSettingsDriver(client, semver)
        case Brand.Google:
            return new StockAndroidSettingsDriver(client)
        default:
            throw new Error("Unsupported brand or platform version: " + brand + ":" + platformVersion + ". Double check that your brand and version are set correctly and your device is supported.")
    }
}


export * from "./types"