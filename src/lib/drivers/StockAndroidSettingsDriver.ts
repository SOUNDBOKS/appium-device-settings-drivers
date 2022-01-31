import { ISettingsDriver, WebdriverBrowser } from ".."
import { isStaleElementException, PhoneDriver, retryIfStaleElementException } from "../PhoneDriver"
import { PairDeviceOptions, PairingFailure, Permission } from "../types"
import { retryIf, retryUntil, retryWithIntermediateStep } from "@soundboks/again"

/**
 * Stock Android Settings Driver
 * 
 * Tested for:
 *  Google Pixel 3 Android Version 12
 */
export default class StockAndroidSettingsDriver extends PhoneDriver implements ISettingsDriver {
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
        await retryIf(async () => this.click((await this.findDeviceDetailsButton(deviceLabel))!), isStaleElementException)
        await this.clickByText("Disconnect")
        await this.navigateUp()
    }

    @retryIfStaleElementException
    async connectDevice(deviceLabel: string): Promise<void> {
        await this.click((await this.findByIncludesText(deviceLabel))!)
    }

    async pairDevice(deviceLabel: string, options?: PairDeviceOptions): Promise<void> {
        const requestPairing = async () => {
            await this.clickByText("Pair new device")
            await retryWithIntermediateStep(async () => {
                await retryWithIntermediateStep(async () => {
                    await retryIf(
                        async () => this.click((await this.findByIncludesText(deviceLabel))!),
                        isStaleElementException
                    )
                }, async () => this.scrollDown())
            }, async () => this.ensureBluetoothReenabled())
        }

        await requestPairing()


        await this.setImplicitTimeout(15000)

        await this.withPatience(15000, async () => {
            if (await this.findByText("Usually 0000 or 1234")) {
                const [pinInput] = await this.findInputs()
                if (!(options?.pincode)) throw new Error("Device expects a pincode, but none was given")
                await this.type(pinInput, options.pincode)
                await this.clickByText("OK")
            } else {
                if (options?.expectPincode) throw new Error("Expected to be asked for a pincode")
                await this.clickByText("Pair")
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
        await retryIf(async () => this.click((await this.findDeviceDetailsButton(deviceLabel))!), isStaleElementException)
        const connected = Boolean(await this.findByText("Disconnect"))
        await this.navigateUp()
        return connected
    }

    async findDeviceDetailsButton(label: string) {
        return this.findElement('xpath', `//*[contains(@text,"${label}")]/../../..//*[@content-desc="Settings"]`);
    }

    @retryIfStaleElementException
    async ensureDeviceUnpaired(deviceLabel: string): Promise<void> {
        const deviceDetailsButton = await this.findDeviceDetailsButton(deviceLabel)
        if (deviceDetailsButton) {
            await this.click(deviceDetailsButton)
            await new Promise(resolve => setTimeout(resolve, 500))
            await this.clickByText("Forget")
            await this.clickByText("Forget device")
        }
    }

    async navigateBluetooth(): Promise<void> {
        await this.scrollUp();
        await this.clickByText("Connected devices")
        await this.wait(500)
    }

    @retryIfStaleElementException
    async navigateUp() {
        await this.click((await this.findElement("xpath", "//*[@content-desc='Navigate up']"))!)
    }

    async activateSettings(): Promise<void> {
        await this.client.activateApp("com.android.settings")
        await this.wait(500)
    }

    async killSettings(): Promise<void> {
        await this.client.terminateApp("com.android.settings")
    }

    async onBluetoothPreferencesPage(fn: () => Promise<void>) {
        // With enough bluetooth devices the connection preferences button can scroll out of view
        await retryWithIntermediateStep(async () => {
            await this.clickByText("Connection preferences")
        }, () => this.scrollDown())

        await this.clickByText("Bluetooth")

        await fn()

        await this.navigateUp()
        await this.navigateUp()
    }

    @retryIfStaleElementException
    async ensureBluetoothEnabled(): Promise<void> {
        await this.onBluetoothPreferencesPage(async () => {
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
        })
    }

    async ensureBluetoothReenabled(): Promise<void> {
        await this.ensureBluetoothDisabled()
        await this.ensureBluetoothEnabled()
    }

    @retryIfStaleElementException
    async ensureBluetoothDisabled(): Promise<void> {
        await this.onBluetoothPreferencesPage(async () => {
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
        })
    }
}