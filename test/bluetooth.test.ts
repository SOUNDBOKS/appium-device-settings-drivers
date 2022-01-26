
import { pod, client, driver } from "./mochaHooks"
import { expect } from "chai"

describe(pod.deviceName + " - bluetooth connectivity & pairing", () => {
    it("should open bluetooth settings", async () => {
        await driver.activateSettings()
        await driver.navigateBluetooth()
    })

    it("should re-enable bluetooth", async () => {
        await driver.ensureBluetoothReenabled()
    })

    it("should ensure the test device is unpaired", async () => {
        await driver.ensureDeviceUnpaired(pod.testDevice)
    })

    it("should pair with the test device", async () => {
        await driver.pairDevice(pod.testDevice)
    })

    it("should ensure test device is connected", async () => {
        expect(await driver.isDeviceConnected(pod.testDevice)).to.be.true
    })

    it("should disconnect from the device", async () => {
        await driver.disconnectDevice(pod.testDevice)
        expect(await driver.isDeviceConnected(pod.testDevice)).to.be.false
    })

    it("should connect to the device", async () => {
        await driver.connectDevice(pod.testDevice)
        expect(await driver.isDeviceConnected(pod.testDevice)).to.be.true
    })
})