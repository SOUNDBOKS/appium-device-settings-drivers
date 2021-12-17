
import LGSettingsDriver from "./drivers/LGSettingsDriver"
import { WebdriverBrowser, Brand, ISettingsDriver } from "./types"



export function createSettingsDriver(
    client: WebdriverBrowser,    
    brand: Brand,
    platformVersion: string,
): ISettingsDriver {
    switch(brand) {
        case Brand.LG:
            return new LGSettingsDriver(client)
        default:
            throw new Error("Unsupported")
    }
}


export * from "./types"