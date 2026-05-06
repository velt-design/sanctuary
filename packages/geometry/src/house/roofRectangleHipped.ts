import type { HouseRoofFeature3D, RoofPlane3D } from '../contracts';
import { RIDGE_COLLAPSE_EPSILON_MM } from './constants';
import { line, point } from './_internal';
import { buildRoofPlane } from './roofPlane';

export function buildRectangleRoofFeatures(input: {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  eaveHeightMm: number;
  roofPitchDeg: number;
}): HouseRoofFeature3D[] {
  const widthX = input.maxX - input.minX;
  const widthY = input.maxY - input.minY;
  const centerX = (input.minX + input.maxX) / 2;
  const centerY = (input.minY + input.maxY) / 2;
  const pitchRisePerRun = Math.tan((input.roofPitchDeg * Math.PI) / 180);
  const features: HouseRoofFeature3D[] = [];
  const corners = [
    point(input.minX, input.minY, input.eaveHeightMm),
    point(input.maxX, input.minY, input.eaveHeightMm),
    point(input.maxX, input.maxY, input.eaveHeightMm),
    point(input.minX, input.maxY, input.eaveHeightMm),
  ];
  if (widthX >= widthY) {
    const halfShort = widthY / 2;
    const ridgeZ = input.eaveHeightMm + halfShort * pitchRisePerRun;
    const startX = input.minX + halfShort;
    const endX = input.maxX - halfShort;
    const start = point(startX, centerY, ridgeZ);
    const end = point(endX, centerY, ridgeZ);
    if (endX - startX > RIDGE_COLLAPSE_EPSILON_MM) {
      features.push({ id: 'house-roof-ridge-1', kind: 'ridge', line: line(start, end), metadata: { roofForm: 'hipped' } });
      for (const [index, corner] of corners.entries()) {
        const target = corner.x <= centerX ? start : end;
        features.push({ id: `house-roof-hip-${index + 1}`, kind: 'hip', line: line(corner, target), metadata: { roofForm: 'hipped' } });
      }
    } else {
      const peak = point(centerX, centerY, ridgeZ);
      for (const [index, corner] of corners.entries()) {
        features.push({ id: `house-roof-hip-${index + 1}`, kind: 'hip', line: line(corner, peak), metadata: { roofForm: 'hipped' } });
      }
    }
    return features;
  }

  const halfShort = widthX / 2;
  const ridgeZ = input.eaveHeightMm + halfShort * pitchRisePerRun;
  const startY = input.minY + halfShort;
  const endY = input.maxY - halfShort;
  const start = point(centerX, startY, ridgeZ);
  const end = point(centerX, endY, ridgeZ);
  if (endY - startY > RIDGE_COLLAPSE_EPSILON_MM) {
    features.push({ id: 'house-roof-ridge-1', kind: 'ridge', line: line(start, end), metadata: { roofForm: 'hipped' } });
    for (const [index, corner] of corners.entries()) {
      const target = corner.y <= centerY ? start : end;
      features.push({ id: `house-roof-hip-${index + 1}`, kind: 'hip', line: line(corner, target), metadata: { roofForm: 'hipped' } });
    }
  } else {
    const peak = point(centerX, centerY, ridgeZ);
    for (const [index, corner] of corners.entries()) {
      features.push({ id: `house-roof-hip-${index + 1}`, kind: 'hip', line: line(corner, peak), metadata: { roofForm: 'hipped' } });
    }
  }
  return features;
}

export function buildRectangleHippedRoof(input: {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  eaveHeightMm: number;
  roofPitchDeg: number;
}): { roofPlanes: RoofPlane3D[]; roofFeatures: HouseRoofFeature3D[] } {
  const widthX = input.maxX - input.minX;
  const widthY = input.maxY - input.minY;
  const centerX = (input.minX + input.maxX) / 2;
  const centerY = (input.minY + input.maxY) / 2;
  const pitchRisePerRun = Math.tan((input.roofPitchDeg * Math.PI) / 180);

  if (widthX >= widthY) {
    const halfShort = widthY / 2;
    const ridgeZ = input.eaveHeightMm + halfShort * pitchRisePerRun;
    const ridgeStartX = input.minX + halfShort;
    const ridgeEndX = input.maxX - halfShort;
    const ridgeAxis: 'x' | 'pyramid' =
      ridgeEndX - ridgeStartX <= RIDGE_COLLAPSE_EPSILON_MM ? 'pyramid' : 'x';
    const highMin = point(ridgeStartX, centerY, ridgeZ);
    const highMax = point(ridgeEndX, centerY, ridgeZ);
    const highMid = point(centerX, centerY, ridgeZ);
    const minYMid = point(centerX, input.minY, input.eaveHeightMm);
    const maxYMid = point(centerX, input.maxY, input.eaveHeightMm);
    const minXMid = point(input.minX, centerY, input.eaveHeightMm);
    const maxXMid = point(input.maxX, centerY, input.eaveHeightMm);

    return {
      roofPlanes: [
        buildRoofPlane({
          id: 'house-roof-min-y',
          boundary:
            ridgeAxis === 'pyramid'
              ? [
                  point(input.minX, input.minY, input.eaveHeightMm),
                  point(input.maxX, input.minY, input.eaveHeightMm),
                  highMid,
                ]
              : [
                  point(input.minX, input.minY, input.eaveHeightMm),
                  point(input.maxX, input.minY, input.eaveHeightMm),
                  highMax,
                  highMin,
                ],
          highPoint: highMid,
          lowPoint: minYMid,
          ridgeAxis,
          pitchDeg: input.roofPitchDeg,
        }),
        buildRoofPlane({
          id: 'house-roof-max-y',
          boundary:
            ridgeAxis === 'pyramid'
              ? [
                  point(input.maxX, input.maxY, input.eaveHeightMm),
                  point(input.minX, input.maxY, input.eaveHeightMm),
                  highMid,
                ]
              : [
                  point(input.maxX, input.maxY, input.eaveHeightMm),
                  point(input.minX, input.maxY, input.eaveHeightMm),
                  highMin,
                  highMax,
                ],
          highPoint: highMid,
          lowPoint: maxYMid,
          ridgeAxis,
          pitchDeg: input.roofPitchDeg,
        }),
        buildRoofPlane({
          id: 'house-roof-min-x',
          boundary: [
            point(input.minX, input.maxY, input.eaveHeightMm),
            point(input.minX, input.minY, input.eaveHeightMm),
            ridgeAxis === 'pyramid' ? highMid : highMin,
          ],
          highPoint: ridgeAxis === 'pyramid' ? highMid : highMin,
          lowPoint: minXMid,
          ridgeAxis,
          pitchDeg: input.roofPitchDeg,
        }),
        buildRoofPlane({
          id: 'house-roof-max-x',
          boundary: [
            point(input.maxX, input.minY, input.eaveHeightMm),
            point(input.maxX, input.maxY, input.eaveHeightMm),
            ridgeAxis === 'pyramid' ? highMid : highMax,
          ],
          highPoint: ridgeAxis === 'pyramid' ? highMid : highMax,
          lowPoint: maxXMid,
          ridgeAxis,
          pitchDeg: input.roofPitchDeg,
        }),
      ],
      roofFeatures: buildRectangleRoofFeatures(input),
    };
  }

  const halfShort = widthX / 2;
  const ridgeZ = input.eaveHeightMm + halfShort * pitchRisePerRun;
  const ridgeStartY = input.minY + halfShort;
  const ridgeEndY = input.maxY - halfShort;
  const ridgeAxis: 'y' | 'pyramid' =
    ridgeEndY - ridgeStartY <= RIDGE_COLLAPSE_EPSILON_MM ? 'pyramid' : 'y';
  const highMin = point(centerX, ridgeStartY, ridgeZ);
  const highMax = point(centerX, ridgeEndY, ridgeZ);
  const highMid = point(centerX, centerY, ridgeZ);
  const minYMid = point(centerX, input.minY, input.eaveHeightMm);
  const maxYMid = point(centerX, input.maxY, input.eaveHeightMm);
  const minXMid = point(input.minX, centerY, input.eaveHeightMm);
  const maxXMid = point(input.maxX, centerY, input.eaveHeightMm);

  return {
    roofPlanes: [
      buildRoofPlane({
        id: 'house-roof-min-y',
        boundary: [
          point(input.maxX, input.minY, input.eaveHeightMm),
          point(input.minX, input.minY, input.eaveHeightMm),
          ridgeAxis === 'pyramid' ? highMid : highMin,
        ],
        highPoint: ridgeAxis === 'pyramid' ? highMid : highMin,
        lowPoint: minYMid,
        ridgeAxis,
        pitchDeg: input.roofPitchDeg,
      }),
      buildRoofPlane({
        id: 'house-roof-max-y',
        boundary: [
          point(input.minX, input.maxY, input.eaveHeightMm),
          point(input.maxX, input.maxY, input.eaveHeightMm),
          ridgeAxis === 'pyramid' ? highMid : highMax,
        ],
        highPoint: ridgeAxis === 'pyramid' ? highMid : highMax,
        lowPoint: maxYMid,
        ridgeAxis,
        pitchDeg: input.roofPitchDeg,
      }),
      buildRoofPlane({
        id: 'house-roof-min-x',
        boundary:
          ridgeAxis === 'pyramid'
            ? [
                point(input.minX, input.maxY, input.eaveHeightMm),
                point(input.minX, input.minY, input.eaveHeightMm),
                highMid,
              ]
            : [
                point(input.minX, input.maxY, input.eaveHeightMm),
                point(input.minX, input.minY, input.eaveHeightMm),
                highMin,
                highMax,
              ],
        highPoint: highMid,
        lowPoint: minXMid,
        ridgeAxis,
        pitchDeg: input.roofPitchDeg,
      }),
      buildRoofPlane({
        id: 'house-roof-max-x',
        boundary:
          ridgeAxis === 'pyramid'
            ? [
                point(input.maxX, input.minY, input.eaveHeightMm),
                point(input.maxX, input.maxY, input.eaveHeightMm),
                highMid,
              ]
            : [
                point(input.maxX, input.minY, input.eaveHeightMm),
                point(input.maxX, input.maxY, input.eaveHeightMm),
                highMax,
                highMin,
              ],
        highPoint: highMid,
        lowPoint: maxXMid,
        ridgeAxis,
        pitchDeg: input.roofPitchDeg,
      }),
    ],
    roofFeatures: buildRectangleRoofFeatures(input),
  };
}
