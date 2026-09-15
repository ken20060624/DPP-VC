{
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://schema.org",
    "https://dpp.eu/schemas/v1/portable-fan.jsonld"
  ],
  "id": "urn:uuid:a1b2c3d4-e5f6-7890-1234-56789abcdef0",
  "type": ["DigitalProductPassport", "VerifiableCredential"],
  "issuer": "did:web:dpp.lapo.com.tw",
  "issuanceDate": "2026-03-15T00:00:00Z",
  "credentialSubject": {
    "id": "urn:gtin:04710000000000:SN202603001",
    "productName": "LaPO 迷你渦輪隨身風扇",
    "modelNumber": "LF-02",
    "brand": "LaPO",
    "countryOfOrigin": "TW",
    "documentation": {
      "userManual": "https://www.lapo.com.tw/manuals/LA-F1-manual.pdf",
      "repairGuide": "https://www.lapo.com.tw/service/LA-F1-repair.pdf" 
    },
    "batteryComponent": {
      "supplierDid": "did:web:cert.battery-supplier.com",
      "chemistry": "Li-ion",
      "capacityMah": 5100,
      "voltageV": 3.7,
      "energyWh": 18.87,
      "certifications": ["BSMI", "UN38.3", "CE", "FCC"],
      "criticalRawMaterials": {
        "cobaltGrams": 2.1,
        "lithiumGrams": 0.56
      }
    },
    "environmentalMetrics": {
      "carbonFootprintKgCO2e": 2.10,
      "pcrPlasticPercentage": 25.0,
      "recyclabilityPercentage": 88.0,
      "rohsCompliant": true,
      "reachCompliant": true
    }
  }
}