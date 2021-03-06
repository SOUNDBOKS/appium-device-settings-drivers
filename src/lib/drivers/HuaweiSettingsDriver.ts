import { ISettingsDriver, WebdriverBrowser } from ".."
import { isStaleElementException, PhoneDriver, retryIfStaleElementException } from "../PhoneDriver"
import { PairDeviceOptions, PairingFailure, Permission } from "../types"
import { retryIf, retryUntil, retryWithIntermediateStep } from "@soundboks/again"
import { coerce, SemVer } from "semver"

/**
 * Huawei Settings Driver
 * 
 * Tested for:
 *  Huawei P10 Android Version 9
 *  Huawei P30 Android Version 10
 *  Huawei P40 Android Version 10
 */
export default class HuaweiSettingsDriver extends PhoneDriver implements ISettingsDriver {
    client: WebdriverBrowser
    platformVersion: SemVer

    constructor(client: WebdriverBrowser, platformVersion: SemVer) {
        super(client, "Android")
        this.client = client
        this.platformVersion = platformVersion
    }

    async allowPermission(permission: Permission): Promise<void> {
        switch (permission) {
            default:
                if (this.platformVersion.major >= 10) {
                    await this.click((await this.findElement("id", "com.android.permissioncontroller:id/permission_allow_foreground_only_button"))!)
                } else {
                    await this.click((await this.findElement("id", "com.android.packageinstaller:id/permission_allow_button"))!)
                }
        }
    }

    async disconnectDevice(deviceLabel: string): Promise<void> {
        await this.click((await this.findByIncludesText(deviceLabel))!)
        await retryIf(async () => this.click((await this.findElement("xpath", "//android.widget.Button[@index='1']"))!), isStaleElementException)
    }

    @retryIfStaleElementException
    async connectDevice(deviceLabel: string): Promise<void> {
        await this.click((await this.findByIncludesText(deviceLabel))!)
    }

    async pairDevice(deviceLabel: string, options?: PairDeviceOptions): Promise<void> {
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

        // Sometimes when the box was just turned on, pairing just randomly fails
        // restarting the bluetooth stack fixes this 
        if (await this.findByIncludesText("pairing mode")) {
            console.warn("Pairing randomly failed? Trying again...")
            await this.ensureBluetoothReenabled()
            await requestPairing()
        }

        await this.setImplicitTimeout(15000)

        await this.withPatience(10000, async () => {
            if (await this.findByText("Usually 0000 or 1234")) {
                const [pinInput] = await this.findInputs()
                await this.type(pinInput, options?.pincode || "0000")
                await this.clickByText("OK")
            } else {
                if (options?.expectPincode) throw new Error("Expected to be asked for a pincode")
                await this.clickByText("PAIR")
            }
        })

        await this.withPatience(10000, async () => {
            if (await Promise.race([this.findByIncludesText("pairing mode"), this.findByIncludesText("An error occured during pairing")])) {
                await this.clickByText("OK").catch(_ => { }) // If it was a random failure, there won't be a popup
                throw new PairingFailure(deviceLabel)
            }
        })

        if (!(await this.findDeviceDetailsButton(deviceLabel))) {
            throw new Error("Failed to assert that device is now paired")
        }

        if(!(await this.isDeviceConnected(deviceLabel))) {
            console.warn("Paired, but not connected. Connecting manually")
            await this.connectDevice(deviceLabel)
        }
    }

    async isDeviceConnected(deviceLabel: string): Promise<boolean> {
        return !!(await this.findElement('xpath', `//*[contains(@text,"${deviceLabel}")]/../..//*[@text="Connected for media audio"]`))
    }

    async findDeviceDetailsButton(label: string) {
        return this.findElement('xpath', `//*[contains(@text,"${label}")]/../../..//*[@content-desc="Details button"]`);
    }


    async ensureDeviceUnpaired(deviceLabel: string): Promise<void> {
        const deviceDetailsButton = await this.findDeviceDetailsButton(deviceLabel)
        if (deviceDetailsButton) {
            await retryIf(async () => await this.click((await this.findDeviceDetailsButton(deviceLabel))!), isStaleElementException)
            await new Promise(resolve => setTimeout(resolve, 500))
            await this.clickByText("UNPAIR")
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
        if (this.platformVersion.major <= 9) {
            await this.clickByText("Device connectivity")
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
        const bluetoothIsOffSwitch = await this.findElement(
            'xpath',
            "//*[@checked='false' and @resource-id='com.android.settings:id/switch_widget']"
        );

        if (bluetoothIsOffSwitch) {
            await this.click(bluetoothIsOffSwitch)
        }

        if (!(await this.findElement(
            'xpath',
            "//*[@checked='true' and @resource-id='com.android.settings:id/switch_widget']"
        ))) {
            throw new Error("Failed to assert that bluetooth is enabled")
        }

        // On Huawei devices, when restarting the BT stack it will automatically try to connect
        // to previous devices, which can take quite a while and will fuck with other things
        await retryUntil(async () => !Boolean(await this.findByText("Connecting...")))
    }

    async ensureBluetoothReenabled(): Promise<void> {
        await this.ensureBluetoothDisabled()
        await this.ensureBluetoothEnabled()
    }

    @retryIfStaleElementException
    async ensureBluetoothDisabled(): Promise<void> {
        let bluetoothIsOnSwitch = await this.findElement(
            'xpath',
            "//*[@checked='true' and @resource-id='com.android.settings:id/switch_widget']"
        );

        if (bluetoothIsOnSwitch) {
            await this.click(bluetoothIsOnSwitch)
        }

        if (!(await this.findElement(
            'xpath',
            "//*[@checked='false' and @resource-id='com.android.settings:id/switch_widget']"
        ))) {
            throw new Error("Failed to assert that bluetooth is disabled")
        }
    }


}