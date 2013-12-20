// Vehicle parameters.
var vehicleMassKg = 1000;
var maxEngineForceNewtons = 6000;

function calculateAccelerationMpsSquared(controllerFn, curSpeedLimit, curSpeedMps) {
  // http://ctms.engin.umich.edu/CTMS/index.php?example=CruiseControl&section=ControlPID
  // http://www.howstuffworks.com/cruise-control3.htm

  // Fixed rolling resistance, value from
  // http://en.wikipedia.org/wiki/Rolling_resistance
  var rollingResistance = 100;

  // From http://www.engineeringtoolbox.com/drag-coefficient-d_627.html
  var airResistance = curSpeedMps * curSpeedMps * 0.348;

  var resistanceForceNewtons = rollingResistance + airResistance;

  var acceleratorPosition = controllerFn(curSpeedLimit, curSpeedMps);
  var inputForceNewtons = 0;
  if (acceleratorPosition > 0) {
    // Engine engaged.
    inputForceNewtons = maxEngineForceNewtons * Math.min(1, acceleratorPosition);
  }

  return (inputForceNewtons - resistanceForceNewtons) / vehicleMassKg;
}

var speedLimitValues = [30, 40, 50, 60, 70, 80, 90, 100];

function adjustSpeedLimit() {
  return speedLimitValues[Math.floor(Math.random() * speedLimitValues.length)];
}

$(document).ready(function() {
  var curTime = 0;
  var endTime = 1000;

  var curSpeedLimit = 0;

  var controllerData = {};
  $.each(controllers, function(name, value) {
    controllerData[name] = {
      controller: value,
      speedValuesMps: [0]
    };
  });

  var times = [];
  var speedSettings = [];
  while (curTime <= endTime) {
    if (curTime % 100 == 0) {
      curSpeedLimit = adjustSpeedLimit();
    }
    times.push(curTime);
    speedSettings.push(curSpeedLimit);

    $.each(controllerData, function(name, data) {
      var speedValues = data.speedValuesMps;
      var curSpeedMps = speedValues[speedValues.length - 1];
      var accelMpsSquared =
          calculateAccelerationMpsSquared(data.controller, curSpeedLimit, curSpeedMps);
      var newSpeed = curSpeedMps + (accelMpsSquared * 1 /* One second.*/);
      // Install a governer, and don't go in reverse.
      speedValues.push(Math.min(Math.max(newSpeed, 0), 220));
    });

    curTime += 1;
  }

  function zip(arrays) {
    return arrays[0].map(function(_, i) {
      return arrays.map(function(array) {
        return array[i];
      });
    });
  }

  function derive(t, y) {
    var first = false;
    return t.map(function(_, i) {
      if (first) {
        first = false;
        return 0;
      } else {
        return (y[i] - y[i - 1]) / (t[i] - t[i - 1]);
      }
    });
  }

  var speedPoints = zip([times, speedSettings].concat($.map(controllerData,
    function(data, _) {
      return [data.speedValuesMps];
    })));
  new Dygraph($('#speed')[0], speedPoints, {
    labelsDiv: 'speedLegend',
    legend: 'always',
    labels: ['t', 'Target'].concat(Object.keys(controllers)),
    ylabel: 'Speed (m/s)'
  });

  var jerkPoints = zip([times].concat($.map(controllerData,
    function(data, _) {
      return [derive(times, derive(times, data.speedValuesMps))];
    })));
  new Dygraph($('#jerk')[0], jerkPoints, {
    labelsDiv: 'jerkLegend',
    legend: 'always',
    labels: ['t'].concat(Object.keys(controllers)),
    ylabel: 'Jerk (m/s^3)'
  });

  var errorPoints = zip([times].concat($.map(controllerData,
    function(data, _) {
      var prev = 0;
      return [data.speedValuesMps.map(function(speed, i) {
        var result = Math.abs(speedSettings[i] - speed);
        if (i != 0) {
          result += prev;
        }
        prev = result;
        return result;
      })];
    })));
  new Dygraph($('#error')[0], errorPoints, {
    labelsDiv: 'errorLegend',
    legend: 'always',
    labels: ['t'].concat(Object.keys(controllers)),
    ylabel: 'Accumulated error (m/s)'
  });
});