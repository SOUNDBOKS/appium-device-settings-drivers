import { ISettingsDriver, WebdriverBrowser } from ".."
import { isStaleElementException, PhoneDriver, retryIfStaleElementException } from "../PhoneDriver"
import { PairDeviceOptions, PairingFailure, Permission } from "../types"
import { retryIf, retryUntil, retryWithIntermediateStep } from "@soundboks/again"

/**
 * Huawei Settings Driver
 * 
 * Tested for:
 *  Huawei P10 Android Version 9
 */
export default class HuaweiSettingsDriver extends PhoneDriver implements ISettingsDriver {
    client: WebdriverBrowser

    constructor(client: WebdriverBrowser) {
        super(client, "Android")
        this.client = client
    }

    async allowPermission(permission: Permission): Promise<void> {
        switch (permission) {
            default:
                await this.click((await this.findElement("id", "com.android.permissioncontroller:id/permission_allow_foreground_only_button"))!)
        }
    }

    async disconnectDevice(deviceLabel: string): Promise<void> {
        await this.click((await this.findByIncludesText(deviceLabel))!)
        await this.clickByText("OK")
    }

    @retryIfStaleElementException
    async connectDevice(deviceLabel: string): Promise<void> {
        await this.click((await this.findByIncludesText(deviceLabel))!)
    }

    async pairDevice(deviceLabel: string, options?: PairDeviceOptions): Promise<void> {
        const requestPairing = async () => {
            await retryWithIntermediateStep(async () => {
                await retryIf(
                    async () => this.click((await this.findByIncludesText(deviceLabel))!),
                    isStaleElementException
                )
            }, async () => this.ensureBluetoothReenabled())
        }

        await requestPairing()

        // Sometimes when the box was just turned on, pairing just randomly fails
        // restarting the bluetooth stack fixes this 
        if (await this.findByIncludesText("pairing mode")) {
            await this.ensureBluetoothReenabled()
            await requestPairing()
        }

        await this.setImplicitTimeout(15000)

        await this.withPatience(15000, async () => {
            if (await this.findByText("Usually 0000 or 1234")) {
                const [pinInput] = await this.findInputs()
                if (!(options?.pincode)) throw new Error("Device expects a pincode, but none was given")
                await this.type(pinInput, options.pincode)
                await this.clickByText("OK")
            } else {
                if (options?.expectPincode) throw new Error("Expected to be asked for a pincode")
            }
        })

        await this.withPatience(10000, async () => {
            if (await Promise.race([this.findByIncludesText("Couldn't pair"), this.findByIncludesText("An error occured during pairing")])) {
                await this.clickByText("OK").catch(_ => { }) // If it was a random failure, there won't be a popup
                throw new PairingFailure(deviceLabel)
            }
        })

        if (!(await this.findDeviceDetailsButton(deviceLabel))) {
            throw new Error("Failed to assert that device is now paired")
        }
    }

    async isDeviceConnected(deviceLabel: string): Promise<boolean> {
        return !!(await this.findElement('xpath', `//*[contains(@text,"${deviceLabel}")]/../..//*[@text="Connected for media audio"]`))
    }

    async findDeviceDetailsButton(label: string) {
        return this.findElement('xpath', `//*[contains(@text,"${label}")]/../../..//*[@content-desc="Details button"]`);
    }

    @retryIfStaleElementException
    async ensureDeviceUnpaired(deviceLabel: string): Promise<void> {
        const deviceDetailsButton = await this.findDeviceDetailsButton(deviceLabel)
        if (deviceDetailsButton) {
            await this.click(deviceDetailsButton)
            await new Promise(resolve => setTimeout(resolve, 500))
            await this.clickByText("UNPAIR")
        }
    }

    async navigateBluetooth(): Promise<void> {
        await this.clickByText("Device connectivity")
        await this.clickByText("Bluetooth")
    }

    async activateSettings(): Promise<void> {
        await this.client.activateApp("com.android.settings")
    }

    @retryIfStaleElementException
    async ensureBluetoothEnabled(): Promise<void> {
        const bluetoothIsOffSwitch = await this.findElement(
            'xpath',
            "//android.widget.Switch[@checked='false']"
        );

        if (bluetoothIsOffSwitch) {
            await this.click(bluetoothIsOffSwitch)
        }

        if (!(await this.findElement(
            'xpath',
            "//android.widget.Switch[@checked='true']"
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
            "//android.widget.Switch[@checked='true']"
        );

        if (bluetoothIsOnSwitch) {
            await this.click(bluetoothIsOnSwitch)
        }

        if (!(await this.findElement(
            'xpath',
            "//android.widget.Switch[@checked='false']"
        ))) {
            throw new Error("Failed to assert that bluetooth is disabled")
        }
    }


}