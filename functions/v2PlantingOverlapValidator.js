'use strict';

const { addIssue } = require('./v2PlanValidationSupport');

function validatePlantingOverlaps(plantings, issues) {
  for (let leftIndex = 0; leftIndex < plantings.length; leftIndex += 1) {
    const left = plantings[leftIndex];
    if (!hasFiniteFootprint(left)) continue;
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < plantings.length;
      rightIndex += 1
    ) {
      const right = plantings[rightIndex];
      if (!hasFiniteFootprint(right) || !rectanglesOverlap(left, right)) {
        continue;
      }
      addIssue(
        issues,
        `plan.plantings[${rightIndex}]`,
        'geometry',
        `Crop-group footprint overlaps plan.plantings[${leftIndex}].`,
      );
    }
  }
}

function hasFiniteFootprint(planting) {
  return ['depthFt', 'widthFt', 'xFt', 'yFt'].every(
    (field) =>
      typeof planting?.[field] === 'number' && Number.isFinite(planting[field]),
  );
}

function rectanglesOverlap(left, right) {
  return (
    Math.abs(left.xFt - right.xFt) < (left.widthFt + right.widthFt) / 2 &&
    Math.abs(left.yFt - right.yFt) < (left.depthFt + right.depthFt) / 2
  );
}

module.exports = { validatePlantingOverlaps };
