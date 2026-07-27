import Foundation
import Capacitor
import HealthKit

/**
 * HealthKit bridge — Capacitor 6 style (CAPBridgedPlugin conformance).
 * Registered manually in MyViewController.swift.
 */
@objc(HealthKitPlugin)
public class HealthKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthKitPlugin"
    public let jsName = "HealthKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "queryHeartRate", returnType: CAPPluginReturnPromise)
    ]

    let store = HKHealthStore()

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit not available on this device")
            return
        }
        guard let hrType = HKQuantityType.quantityType(forIdentifier: .heartRate) else {
            call.reject("Heart rate type unavailable")
            return
        }
        store.requestAuthorization(toShare: nil, read: [hrType]) { ok, err in
            if let err = err {
                call.reject(err.localizedDescription)
            } else {
                call.resolve(["granted": ok])
            }
        }
    }

    @objc func queryHeartRate(_ call: CAPPluginCall) {
        guard let startMs = call.getDouble("start"),
              let endMs = call.getDouble("end") else {
            call.reject("start and end (ms since epoch) are required")
            return
        }
        guard let hrType = HKQuantityType.quantityType(forIdentifier: .heartRate) else {
            call.reject("Heart rate type unavailable")
            return
        }
        let start = Date(timeIntervalSince1970: startMs / 1000.0)
        let end = Date(timeIntervalSince1970: endMs / 1000.0)
        let pred = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)

        let q = HKSampleQuery(sampleType: hrType,
                              predicate: pred,
                              limit: HKObjectQueryNoLimit,
                              sortDescriptors: [sort]) { _, samples, err in
            if let err = err {
                call.reject(err.localizedDescription)
                return
            }
            let unit = HKUnit.count().unitDivided(by: HKUnit.minute())
            let vals: [[String: Double]] = (samples as? [HKQuantitySample])?.map {
                [
                    "bpm": $0.quantity.doubleValue(for: unit),
                    "t": $0.startDate.timeIntervalSince1970 * 1000.0
                ]
            } ?? []
            call.resolve(["samples": vals])
        }
        store.execute(q)
    }
}
