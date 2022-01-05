import { retryIf } from "@soundboks/again";
import { isStaleElementException, PhoneDriver, retryIfStaleElementException } from "../PhoneDriver";
import { ISettingsDriver, PairDeviceOptions, PairingFailure, Permission, WebdriverBrowser } from "../types";

export default class OnePlusSettingsDriver extends PhoneDriver implements ISettingsDriver {
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
        
        await retryIf(async () => this.click((await this.findByIncludesText(deviceLabel))!), isStaleElementException)

        await this.withPatience(15000, async () => {
            if(await this.findByText("Usually 0000 or 1234")) {
                const [pinInput] = await this.findInputs()
                if (!(options?.pincode)) throw new Error("Device expects a pincode, but none was given")
                await this.type(pinInput, options.pincode)
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

    async navigateBluetooth(): Promise<void> {
        await this.scrollUp();
        await this.clickByText("Bluetooth & Device Connection")
        await this.clickByText("Bluetooth")
    }

    async activateSettings(): Promise<void> {
        await this.client.activateApp("com.android.settings")
    }

    @retryIfStaleElementException
    async ensureBluetoothEnabled(): Promise<void> {
        const bluetoothIsOffText = (await this.findElement(
            'xpath',
            "//android.widget.Switch/../../*[@text='Off']"
        ))

        if (bluetoothIsOffText) {
            await this.click((await this.findElement(
                "xpath",
                "//android.widget.Switch"
            ))!)
        }

        if (!(await this.findElement(
            'xpath',
            "//android.widget.Switch/../../*[@text='On']"
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