from bridge.simulate import sim_watts, PERIOD_S, WATTS_THRESHOLD


def test_sim_watts_peaks_above_threshold():
    # quarter period = sine peak => well above the alert line
    assert sim_watts(PERIOD_S / 4) > WATTS_THRESHOLD


def test_sim_watts_troughs_below_threshold():
    # three-quarter period = sine trough => safely normal
    assert sim_watts(PERIOD_S * 3 / 4) < WATTS_THRESHOLD


def test_sim_watts_never_negative():
    for t in range(0, 120):
        assert sim_watts(t) >= 0
