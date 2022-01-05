
import iOSSettingsDriver from "./drivers/iOSSettingsDriver"
import LGSettingsDriver from "./drivers/LGSettingsDriver"
import OnePlusSettingsDriver from "./drivers/OnePlusSettingsDriver"
import { WebdriverBrowser, Brand, ISettingsDriver } from "./types"



export function createSettingsDriver(
    client: WebdriverBrowser,    
    brand: Brand,
    platformVersion: string,
): ISettingsDriver {
    switch(brand) {
        case Brand.iPhone:
            return new iOSSettingsDriver(client)
        case Brand.LG:
            return new LGSettingsDriver(client)
        case Brand.OnePlus:
            return new OnePlusSettingsDriver(client)
        default:
            throw new Error("Unsupported brand or platform version: " + brand + ":" + platformVersion + ". Double check that your brand and version are set correctly and your device is supported.")
    }
}


export * from "./types"