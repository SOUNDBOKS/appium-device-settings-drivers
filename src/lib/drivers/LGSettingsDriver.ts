import { retryWithIntermediateStep, retryIf } from "@soundboks/again";
import { isStaleElementException, PhoneDriver, retryIfStaleElementException } from "../PhoneDriver";
import { ISettingsDriver, PairDeviceOptions, PairingFailure, Permission, WebdriverBrowser } from "../types";

export default class LGSettingsDriver extends PhoneDriver implements ISettingsDriver {
    client: WebdriverBrowser

    constructor(client: WebdriverBrowser) {
        super(client, "Android")
        this.client = client
    }

    async allowPermission(permission: Permission): Promise<void> {
        switch(permission) {
            default:
                await this.click((await this.findElement("id", "com.android.permissioncontroller:id/permission_allow_foreground_only_button"))!)
        }
    }
    
    async disconnectDevice(deviceLabel: string): Promise<void> {
        await this.click((await this.findByIncludesText(deviceLabel))!)
        await this.clickByText("Disconnect")
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
        
        await this.withPatience(10000, async () => {
            if(await this.findByText("e.g. 0000 or 1234")) {
                const [pinInput] = await this.findInputs()
                await this.type(pinInput, options?.pincode || "0000")
                await this.clickByText("Pair")
            } else {
                if (options?.expectPincode) throw new Error("Expected to be asked for a pincode")
                await this.clickByText("Pair")
            }
        })

        if (await this.findByIncludesText("Cannot pair")) {
            await this.clickByText("OK")
            throw new PairingFailure(deviceLabel)
        }
        if (!(await this.findDeviceDetailsButton(deviceLabel))) {
            throw new Error("Failed to assert that device is now paired")
        }
    }

    async isDeviceConnected(deviceLabel: string): Promise<boolean> {
        return !!(await this.findElement('xpath', `//*[contains(@text,"${deviceLabel}")]/..//*[@text="Connected to media audio"]`))
    }

    async findDeviceDetailsButton(label: string) {
        return this.findElement('xpath', `//*[contains(@text,"${label}")]/../..//*[@content-desc="Device Settings"]`);
    }

    async ensureDeviceUnpaired(deviceLabel: string): Promise<void> {
        const deviceDetailsButton = await this.findDeviceDetailsButton(deviceLabel)
        if (deviceDetailsButton) {
            await this.click(deviceDetailsButton)
            await this.clickByText("Unpair")
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
        await this.clickByText("Connected devices")
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
    }

    async ensureBluetoothReenabled(): Promise<void> {
        await this.ensureBluetoothDisabled()
        await this.ensureBluetoothEnabled()
        await (this.click((await this.findElement("xpath", '//*[@content-desc="Refresh"]'))!).catch(err => console.error("Failed to refresh bluetooth devices", err)))
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