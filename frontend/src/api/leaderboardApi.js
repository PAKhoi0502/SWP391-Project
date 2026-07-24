import api from '../services/api'

const unwrap = (response) => response?.data?.data ?? response?.data ?? response

const leaderboardApi = {
  async getLeaderboard({ period = 'MONTHLY', page = 1, limit = 10 } = {}) {
    const params = new URLSearchParams({ period, page, limit })
    const response = await api.get(`/loyalty/leaderboard?${params}`)
    return unwrap(response)
    // Returns: { period, periodStart, periodEnd, topThree, entries, currentUser, page, limit, totalItems, totalPages }
  },
}

export default leaderboardApi
