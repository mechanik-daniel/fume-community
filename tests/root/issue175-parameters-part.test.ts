/**
 * © Copyright Outburn Ltd. 2022-2024 All Rights Reserved
 *   Project name: FUME-COMMUNITY
 */
import { expect, test } from '@jest/globals';
import request from 'supertest';

import { mockInput } from '../utils/mockInput';

test('Issue #175 - Parameters.parameter.part[] should be populated', async () => {
  const mapping = `
InstanceOf: Parameters

* parameter
  * name = 'operation'
  * part
    * name = 'op'
    * valueCode = 'replace'
  * part
    * name = 'path'
    * valueString = '/active'
  * part
    * name = 'value'
    * valueBoolean = true
`;

  const requestBody = {
    input: mockInput,
    fume: mapping
  };

  const res = await request(globalThis.app).post('/').send(requestBody);

  expect(res.status).toBe(200);
  expect(res.body).toStrictEqual({
    resourceType: 'Parameters',
    parameter: [
      {
        name: 'operation',
        part: [
          { name: 'op', valueCode: 'replace' },
          { name: 'path', valueString: '/active' },
          { name: 'value', valueBoolean: true }
        ]
      }
    ]
  });
});
