//
// SPDX-FileCopyrightText: 2026 SAP SE or an SAP affiliate company and Gardener contributors
//
// SPDX-License-Identifier: Apache-2.0
//
'use strict'
const { mockRequest } = require('@gardener-dashboard/request')
describe('api', function () {
  let agent
  beforeAll(() => {
    agent = createAgent()
  })
  afterAll(() => {
    return agent.close()
  })
  beforeEach(() => {
    mockRequest.mockReset()
  })
  describe('all namespaced cloudprofiles', function () {
    const user = fixtures.user.create({ id: 'john.doe@example.org' })
    it('should return all namespaced cloudprofiles from authorized namespaces', async function () {
      mockRequest
        .mockImplementationOnce(fixtures.auth.mocks.reviewSelfSubjectAccess({ allowed: true }))
        .mockImplementationOnce(fixtures.auth.mocks.reviewSelfSubjectAccess({ allowed: false }))
      const res = await agent
        .get('/api/namespacedcloudprofiles')
        .set('cookie', await user.cookie)
        .expect('content-type', /json/)
        .expect(200)
      expect(mockRequest).toHaveBeenCalledTimes(2)
      expect(res.body).toBeInstanceOf(Array)
      expect(res.body.length).toBe(2)
      expect(res.body.every(profile => profile.metadata.namespace === 'garden-local')).toBe(true)
    })
    it('should return all cloudprofiles when authorized for all namespaces', async function () {
      mockRequest
        .mockImplementationOnce(fixtures.auth.mocks.reviewSelfSubjectAccess({ allowed: true }))
        .mockImplementationOnce(fixtures.auth.mocks.reviewSelfSubjectAccess({ allowed: true }))
      const res = await agent
        .get('/api/namespacedcloudprofiles')
        .set('cookie', await user.cookie)
        .expect('content-type', /json/)
        .expect(200)
      expect(mockRequest).toHaveBeenCalledTimes(2)
      expect(res.body).toBeInstanceOf(Array)
      expect(res.body.length).toBe(3)
    })
    it('should return empty array when not authorized for any namespace', async function () {
      mockRequest
        .mockImplementationOnce(fixtures.auth.mocks.reviewSelfSubjectAccess({ allowed: false }))
        .mockImplementationOnce(fixtures.auth.mocks.reviewSelfSubjectAccess({ allowed: false }))
      const res = await agent
        .get('/api/namespacedcloudprofiles')
        .set('cookie', await user.cookie)
        .expect('content-type', /json/)
        .expect(200)
      expect(mockRequest).toHaveBeenCalledTimes(2)
      expect(res.body).toBeInstanceOf(Array)
      expect(res.body.length).toBe(0)
    })
    it('should verify authorization checks with snapshot', async function () {
      mockRequest
        .mockImplementationOnce(fixtures.auth.mocks.reviewSelfSubjectAccess({ allowed: true }))
        .mockImplementationOnce(fixtures.auth.mocks.reviewSelfSubjectAccess({ allowed: true }))
      await agent
        .get('/api/namespacedcloudprofiles')
        .set('cookie', await user.cookie)
        .expect(200)
      expect(mockRequest).toHaveBeenCalledTimes(2)
      expect(mockRequest.mock.calls).toMatchSnapshot()
    })
  })
})
