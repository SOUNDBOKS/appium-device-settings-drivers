import { retryIf, retryWithIntermediateStep } from "@soundboks/again";
import { SemVer } from "semver";
import { isStaleElementException, PhoneDriver, retryIfStaleElementException } from "../PhoneDriver";
import { ISettingsDriver, PairDeviceOptions, PairingFailure, Permission, WebdriverBrowser } from "../types";

/**
 * OnePlus Settings Driver
 * 
 * Tested for:
 *  OnePlus 8T Android Version 11
 */

export default class OnePlusSettingsDriver extends PhoneDriver implements ISettingsDriver {
    client: WebdriverBrowser
    platformVersion: SemVer

    constructor(client: WebdriverBrowser, platformVersion: SemVer) {
        super(client, "Android")
        this.client = client
        this.platformVersion = platformVersion
    }

    async allowPermission(permission: Permission): Promise<void> {
        switch(permission) {
            case Permission.Notifications:
                if (this.platformVersion.major >= 12) {
                    throw new Error("Unimplemented")
                }
            default:
                if (this.platformVersion.major < 12) {
                    await this.click((await this.findElement("id", "com.android.permissioncontroller:id/permission_allow_foreground_only_button"))!)
                } else {
                    await this.click((await this.findElement("id", "com.android.permissioncontroller:id/permission_allow_button"))!)
                }
        }
    }
    
    async disconnectDevice(deviceLabel: string): Promise<void> {
        await this.click((await this.findDeviceDetailsButton(deviceLabel))!)
        await this.clickByText("Disconnect")
        await this.click((await this.findElement("xpath", "//*[@content-desc='Navigate up']"))!)
    }

    @retryIfStaleElementException
    async connectDevice(deviceLabel: string): Promise<void> {
        await this.click((await this.findByIncludesText(deviceLabel))!)
    }

    async pairDevice(deviceLabel: string, options?: PairDeviceOptions): Promise<void> {
        await this.clickByText("Pair new device")
        
        const requestPairing = async () => {
            await retryWithIntermediateStep(async () => {
                await retryWithIntermediateStep(async () => {
                    await retryIf(
                        async () => this.click((await this.findByIncludesText(deviceLabel))!),
                        isStaleElementException
                    )
                }, async () => this.scrollDown())
            }, async () => this.ensureBluetoothReenabled(), { waitTime: 5000 })
        }

        await requestPairing()
        
        await this.withPatience(15000, async () => {
            if(await this.findByText("Usually 0000 or 1234")) {
                const [pinInput] = await this.findInputs()
                await this.type(pinInput, options?.pincode || "0000")
                await this.clickByText("OK")
            } else {
                if (options?.expectPincode) throw new Error("Expected to be asked for a pincode")
                await this.clickByText("Pair")
            }
        })

        if (await this.findByIncludesText("incorrect PIN")) {
            throw new PairingFailure(deviceLabel)
        }
        if (!(await this.findDeviceDetailsButton(deviceLabel))) {
            throw new Error("Failed to assert that device is now paired")
        }
    }

    async isDeviceConnected(deviceLabel: string): Promise<boolean> {
        return !!(await this.findElement('xpath', `//*[contains(@text,"${deviceLabel}")]/..//*[@text="Active"]`))
    }

    async findDeviceDetailsButton(label: string) {
        return this.findElement('xpath', `//*[contains(@text,"${label}")]/../../..//*[@content-desc="Settings"]`);
    }

    async ensureDeviceUnpaired(deviceLabel: string): Promise<void> {
        const deviceDetailsButton = await this.findDeviceDetailsButton(deviceLabel)
        if (deviceDetailsButton) {
            await this.click(deviceDetailsButton)
            await this.clickByText("Forget")
            await this.clickByText("Forget device")
        }
    }


    @retryIfStaleElementException
    async ensureAllDevicesUnpaired(): Promise<void> {
        while(true) {
            let detailsButton = await this.findDeviceDetailsButton("");

            if (detailsButton) {
                await this.ensureDeviceUnpaired("")
            } else {
                return;
            }
        }
    }

    async navigateBluetooth(): Promise<void> {
        await this.scrollUp();
        
        // Needs more testing, but OnePlus at one point moved Bluetooth out to the top level around V12
        if (this.platformVersion.major < 12) {
            await this.clickByText("Bluetooth & Device Connection")
        }
        await this.clickByText("Bluetooth")
    }

    async activateSettings(): Promise<void> {
        await this.client.activateApp("com.android.settings")
    }

    async killSettings(): Promise<void> {
        await this.client.terminateApp("com.android.settings")
    }

    @retryIfStaleElementException
    async ensureBluetoothEnabled(): Promise<void> {
        // OnePlus moved the on/off text on to the switch itself in version 12
        const textSelector = (val: string) => this.platformVersion.major < 12 ?
            `//android.widget.Switch/../../*[@text='${val}']` :
            `//android.widget.Switch[@text='${val}']`

        const bluetoothIsOffText = (await this.findElement(
            'xpath',
            textSelector("Off"),
        ))

        if (bluetoothIsOffText) {
            await this.click((await this.findElement(
                "xpath",
                "//android.widget.Switch"
            ))!)
        }

        if (!(await this.findElement(
            'xpath',
            textSelector("On")
        ))) {
            throw new Error("Failed to assert that bluetooth is enabled")
        }
    }

    async ensureBluetoothReenabled(): Promise<void> {
        await this.ensureBluetoothDisabled()
        await this.ensureBluetoothEnabled()
    }

    @retryIfStaleElementException
    async ensureBluetoothDisabled(): Promise<void> {
        let bluetoothIsOnText = await this.findElement(
            'xpath',
            "//android.widget.Switch/../../*[@text='On']"
        );

        if (bluetoothIsOnText) {
            await this.click((await this.findElement(
                "xpath",
                "//android.widget.Switch"
            ))!)
        }

        if (!(await this.findElement(
            'xpath',
            "//android.widget.Switch/../../*[@text='Off']"
        ))) {
            throw new Error("Failed to assert that bluetooth is disabled")
        }
    }

}