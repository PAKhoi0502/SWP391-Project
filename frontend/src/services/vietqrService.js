let cachedBanks = null

export const vietqrService = {
  async getBanks() {
    if (cachedBanks) return cachedBanks
    const res = await fetch('https://api.vietqr.io/v2/banks')
    const json = await res.json()
    cachedBanks = Array.isArray(json?.data) ? json.data : []
    return cachedBanks
  },
}
