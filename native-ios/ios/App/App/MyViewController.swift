import UIKit
import Capacitor

/**
 * Capacitor 6 requires in-app plugins to be registered explicitly.
 * This subclass does that, and Main.storyboard must point at it.
 */
class MyViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HealthKitPlugin())
    }
}
