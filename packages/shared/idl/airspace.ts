/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/airspace.json`.
 */
export type Airspace = {
  "address": "5PNnqSxWCktbS7pUtt5MXCuQEVfztjYuLpvVvbB3oxeZ",
  "metadata": {
    "name": "airspace",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "AirSpace: NYC air-rights registry and marketplace on Solana"
  },
  "instructions": [
    {
      "name": "buyParcel",
      "docs": [
        "Buys a listed parcel: Pyth SOL/USD converts the USD price into lamports,",
        "the fee goes to the treasury, the rest to the seller, and the escrow PDA",
        "hands the asset to the KYC-attested buyer."
      ],
      "discriminator": [
        31,
        210,
        32,
        152,
        108,
        178,
        85,
        0
      ],
      "accounts": [
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        },
        {
          "name": "registry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "parcel",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  114,
                  99,
                  101,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "parcel.bbl",
                "account": "parcel"
              }
            ]
          },
          "relations": [
            "listing"
          ]
        },
        {
          "name": "listing",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  115,
                  116,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "parcel"
              }
            ]
          }
        },
        {
          "name": "seller",
          "writable": true,
          "relations": [
            "listing"
          ]
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "buyerAttestation"
        },
        {
          "name": "priceUpdate"
        },
        {
          "name": "asset",
          "writable": true
        },
        {
          "name": "collection",
          "writable": true
        },
        {
          "name": "escrow",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              }
            ]
          }
        },
        {
          "name": "mplCoreProgram",
          "address": "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "cancelListing",
      "docs": [
        "Cancels a listing: escrow PDA returns the asset to the seller."
      ],
      "discriminator": [
        41,
        183,
        50,
        232,
        230,
        233,
        157,
        70
      ],
      "accounts": [
        {
          "name": "seller",
          "writable": true,
          "signer": true,
          "relations": [
            "listing"
          ]
        },
        {
          "name": "parcel",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  114,
                  99,
                  101,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "parcel.bbl",
                "account": "parcel"
              }
            ]
          },
          "relations": [
            "listing"
          ]
        },
        {
          "name": "listing",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  115,
                  116,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "parcel"
              }
            ]
          }
        },
        {
          "name": "asset",
          "writable": true
        },
        {
          "name": "collection",
          "writable": true
        },
        {
          "name": "escrow",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              }
            ]
          }
        },
        {
          "name": "mplCoreProgram",
          "address": "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "createCollection",
      "docs": [
        "Creates the Metaplex Core collection; the registry PDA is its update authority."
      ],
      "discriminator": [
        156,
        251,
        92,
        54,
        233,
        2,
        16,
        82
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "registry"
          ]
        },
        {
          "name": "registry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "collection",
          "docs": [
            "Fresh keypair; becomes the Core collection account."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "mplCoreProgram",
          "address": "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "uri",
          "type": "string"
        }
      ]
    },
    {
      "name": "initializeRegistry",
      "docs": [
        "Creates the singleton `Registry`."
      ],
      "discriminator": [
        189,
        181,
        20,
        17,
        174,
        57,
        249,
        59
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "registry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "registrar",
          "type": "pubkey"
        },
        {
          "name": "treasury",
          "type": "pubkey"
        },
        {
          "name": "forwarderProgram",
          "type": "pubkey"
        },
        {
          "name": "feeBps",
          "type": "u16"
        },
        {
          "name": "maxPriceAgeSecs",
          "type": "u32"
        }
      ]
    },
    {
      "name": "listParcel",
      "docs": [
        "Lists a parcel: the Core asset moves into the escrow PDA."
      ],
      "discriminator": [
        130,
        223,
        115,
        4,
        28,
        75,
        19,
        161
      ],
      "accounts": [
        {
          "name": "seller",
          "writable": true,
          "signer": true
        },
        {
          "name": "registry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "parcel",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  114,
                  99,
                  101,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "parcel.bbl",
                "account": "parcel"
              }
            ]
          }
        },
        {
          "name": "listing",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  115,
                  116,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "parcel"
              }
            ]
          }
        },
        {
          "name": "asset",
          "writable": true
        },
        {
          "name": "collection",
          "writable": true
        },
        {
          "name": "escrow",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              }
            ]
          }
        },
        {
          "name": "mplCoreProgram",
          "address": "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "priceUsdCents",
          "type": "u64"
        }
      ]
    },
    {
      "name": "mintParcel",
      "docs": [
        "Mints the Core asset for an `Allow` verdict, gated by an SAS owner attestation."
      ],
      "discriminator": [
        158,
        42,
        246,
        137,
        217,
        57,
        167,
        210
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "registry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "verdict",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  114,
                  100,
                  105,
                  99,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "verdict.bbl",
                "account": "verdict"
              }
            ]
          }
        },
        {
          "name": "ownerAttestation",
          "docs": [
            "are verified in `sas::verify_owner_attestation`."
          ]
        },
        {
          "name": "parcel",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  114,
                  99,
                  101,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "verdict.bbl",
                "account": "verdict"
              }
            ]
          }
        },
        {
          "name": "asset",
          "docs": [
            "Fresh keypair; becomes the Core asset account."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "collection",
          "writable": true
        },
        {
          "name": "mplCoreProgram",
          "address": "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "mintParcelArgs"
            }
          }
        }
      ]
    },
    {
      "name": "onReport",
      "docs": [
        "Entry point for the Chainlink keystone forwarder CPI. The forwarder has",
        "already verified the DON signatures; this only checks that the CPI really",
        "came from the configured forwarder program, then decodes the report."
      ],
      "discriminator": [
        214,
        173,
        18,
        221,
        173,
        148,
        151,
        208
      ],
      "accounts": [
        {
          "name": "state"
        },
        {
          "name": "forwarderAuthority",
          "docs": [
            "PDA signer supplied by the forwarder CPI; verified in `verify_forwarder_cpi`."
          ],
          "signer": true
        },
        {
          "name": "registry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "verdict",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  114,
                  100,
                  105,
                  99,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "verdict.bbl",
                "account": "verdict"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "metadata",
          "type": "bytes"
        },
        {
          "name": "report",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "openVerdict",
      "docs": [
        "Opens (or re-opens) the verdict for a BBL. Safe to call repeatedly; a verdict",
        "that is `Allow` and already backed by a minted parcel cannot be reset."
      ],
      "discriminator": [
        129,
        74,
        141,
        23,
        125,
        39,
        240,
        218
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "verdict",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  114,
                  100,
                  105,
                  99,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "bbl"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "parcel",
          "docs": [
            "exist yet); the address is enforced by the seeds constraint."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  114,
                  99,
                  101,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "bbl"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "bbl",
          "type": "string"
        }
      ]
    },
    {
      "name": "recordVerdictManual",
      "docs": [
        "Registrar fallback / demo path for recording a verdict."
      ],
      "discriminator": [
        193,
        154,
        126,
        9,
        149,
        124,
        214,
        208
      ],
      "accounts": [
        {
          "name": "registrar",
          "signer": true,
          "relations": [
            "registry"
          ]
        },
        {
          "name": "registry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "verdict",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  114,
                  100,
                  105,
                  99,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "verdict.bbl",
                "account": "verdict"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "status",
          "type": "u8"
        },
        {
          "name": "confidenceBps",
          "type": "u16"
        },
        {
          "name": "flags",
          "type": "u32"
        },
        {
          "name": "unusedSqft",
          "type": "u64"
        },
        {
          "name": "estValueUsd",
          "type": "u64"
        },
        {
          "name": "reportHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "setAttestationConfig",
      "docs": [
        "Stores the SAS credential / schema keys used to validate attestations."
      ],
      "discriminator": [
        18,
        220,
        255,
        4,
        72,
        218,
        233,
        45
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "registry"
          ]
        },
        {
          "name": "registry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "ownerCredential",
          "type": "pubkey"
        },
        {
          "name": "ownerSchema",
          "type": "pubkey"
        },
        {
          "name": "kycCredential",
          "type": "pubkey"
        },
        {
          "name": "kycSchema",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "setForwarder",
      "docs": [
        "Admin-only: switches the keystone forwarder program allowed to call `on_report`",
        "(e.g. simulator mock forwarder <-> production DON forwarder) without redeploying."
      ],
      "discriminator": [
        95,
        60,
        153,
        138,
        227,
        50,
        50,
        14
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "registry"
          ]
        },
        {
          "name": "registry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "forwarderProgram",
          "type": "pubkey"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "listing",
      "discriminator": [
        218,
        32,
        50,
        73,
        43,
        134,
        26,
        58
      ]
    },
    {
      "name": "parcel",
      "discriminator": [
        149,
        167,
        245,
        67,
        209,
        244,
        214,
        75
      ]
    },
    {
      "name": "registry",
      "discriminator": [
        47,
        174,
        110,
        246,
        184,
        182,
        252,
        218
      ]
    },
    {
      "name": "verdict",
      "discriminator": [
        169,
        1,
        171,
        69,
        24,
        106,
        66,
        193
      ]
    }
  ],
  "events": [
    {
      "name": "listingCancelled",
      "discriminator": [
        11,
        46,
        163,
        10,
        103,
        80,
        139,
        194
      ]
    },
    {
      "name": "parcelListed",
      "discriminator": [
        10,
        138,
        75,
        142,
        102,
        248,
        110,
        51
      ]
    },
    {
      "name": "parcelMinted",
      "discriminator": [
        162,
        154,
        225,
        23,
        24,
        114,
        153,
        38
      ]
    },
    {
      "name": "parcelSold",
      "discriminator": [
        80,
        203,
        139,
        89,
        23,
        190,
        205,
        222
      ]
    },
    {
      "name": "verdictRecorded",
      "discriminator": [
        144,
        96,
        183,
        176,
        102,
        238,
        139,
        155
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Signer is not authorized for this action"
    },
    {
      "code": 6001,
      "name": "verdictNotAllowed",
      "msg": "Verdict status is not Allow"
    },
    {
      "code": 6002,
      "name": "verdictLocked",
      "msg": "Verdict is locked because a parcel was already minted for this BBL"
    },
    {
      "code": 6003,
      "name": "bblMismatch",
      "msg": "Report BBL does not match the verdict account"
    },
    {
      "code": 6004,
      "name": "invalidAttestation",
      "msg": "Attestation account failed validation"
    },
    {
      "code": 6005,
      "name": "attestationExpired",
      "msg": "Attestation has expired"
    },
    {
      "code": 6006,
      "name": "invalidForwarderProgram",
      "msg": "Forwarder state is not owned by the configured forwarder program"
    },
    {
      "code": 6007,
      "name": "invalidForwarderAuthority",
      "msg": "forwarder_authority is not the expected forwarder PDA"
    },
    {
      "code": 6008,
      "name": "invalidReportPayload",
      "msg": "Report payload is not a valid Borsh VerdictReport"
    },
    {
      "code": 6009,
      "name": "invalidPriceAccount",
      "msg": "Price update account failed validation"
    },
    {
      "code": 6010,
      "name": "stalePrice",
      "msg": "Price update is older than the configured tolerance"
    },
    {
      "code": 6011,
      "name": "wrongFeed",
      "msg": "Price update is for a different feed"
    },
    {
      "code": 6012,
      "name": "parcelNotListed",
      "msg": "Parcel is not listed"
    },
    {
      "code": 6013,
      "name": "parcelAlreadyListed",
      "msg": "Parcel is already listed"
    },
    {
      "code": 6014,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6015,
      "name": "invalidArgs",
      "msg": "Invalid instruction arguments"
    }
  ],
  "types": [
    {
      "name": "listing",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "parcel",
            "type": "pubkey"
          },
          {
            "name": "seller",
            "type": "pubkey"
          },
          {
            "name": "priceUsdCents",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "listingCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bbl",
            "type": "string"
          },
          {
            "name": "asset",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "mintParcelArgs",
      "docs": [
        "Arguments for `mint_parcel`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "address",
            "type": "string"
          },
          {
            "name": "borough",
            "type": "u8"
          },
          {
            "name": "latE6",
            "type": "i32"
          },
          {
            "name": "lngE6",
            "type": "i32"
          },
          {
            "name": "lotAreaSqft",
            "type": "u32"
          },
          {
            "name": "builtAreaSqft",
            "type": "u32"
          },
          {
            "name": "maxFarBps",
            "type": "u32"
          },
          {
            "name": "zoning",
            "type": "string"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "uri",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "parcel",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bbl",
            "type": "string"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "coreAsset",
            "type": "pubkey"
          },
          {
            "name": "address",
            "type": "string"
          },
          {
            "name": "borough",
            "docs": [
              "1 MN, 2 BX, 3 BK, 4 QN, 5 SI"
            ],
            "type": "u8"
          },
          {
            "name": "latE6",
            "type": "i32"
          },
          {
            "name": "lngE6",
            "type": "i32"
          },
          {
            "name": "lotAreaSqft",
            "type": "u32"
          },
          {
            "name": "builtAreaSqft",
            "type": "u32"
          },
          {
            "name": "maxFarBps",
            "docs": [
              "FAR * 10000 (15.0 -> 150000)"
            ],
            "type": "u32"
          },
          {
            "name": "unusedSqft",
            "docs": [
              "Copied from Verdict at mint."
            ],
            "type": "u64"
          },
          {
            "name": "estValueUsd",
            "docs": [
              "Copied from Verdict at mint."
            ],
            "type": "u64"
          },
          {
            "name": "zoning",
            "type": "string"
          },
          {
            "name": "verdictHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "status",
            "docs": [
              "0 Minted, 1 Listed"
            ],
            "type": "u8"
          },
          {
            "name": "mintedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "parcelListed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bbl",
            "type": "string"
          },
          {
            "name": "asset",
            "type": "pubkey"
          },
          {
            "name": "seller",
            "type": "pubkey"
          },
          {
            "name": "priceUsdCents",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "parcelMinted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bbl",
            "type": "string"
          },
          {
            "name": "asset",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "parcelSold",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bbl",
            "type": "string"
          },
          {
            "name": "asset",
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "seller",
            "type": "pubkey"
          },
          {
            "name": "priceUsdCents",
            "type": "u64"
          },
          {
            "name": "lamportsPaid",
            "type": "u64"
          },
          {
            "name": "solUsdPriceE8",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "registry",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "registrar",
            "docs": [
              "May call `record_verdict_manual`; pays `open_verdict` from the web app."
            ],
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "forwarderProgram",
            "docs": [
              "Chainlink keystone forwarder program id allowed to CPI `on_report`."
            ],
            "type": "pubkey"
          },
          {
            "name": "collection",
            "docs": [
              "Metaplex Core collection (set by `create_collection`)."
            ],
            "type": "pubkey"
          },
          {
            "name": "ownerCredential",
            "docs": [
              "SAS credential pubkey for owner attestations."
            ],
            "type": "pubkey"
          },
          {
            "name": "ownerSchema",
            "docs": [
              "SAS schema \"airspace_owner_v1\"."
            ],
            "type": "pubkey"
          },
          {
            "name": "kycCredential",
            "type": "pubkey"
          },
          {
            "name": "kycSchema",
            "docs": [
              "SAS schema \"airspace_kyc_v1\"."
            ],
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "docs": [
              "Marketplace fee on sale, e.g. 100 = 1%."
            ],
            "type": "u16"
          },
          {
            "name": "maxPriceAgeSecs",
            "docs": [
              "Pyth staleness tolerance in seconds."
            ],
            "type": "u32"
          },
          {
            "name": "parcelCount",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "verdict",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bbl",
            "type": "string"
          },
          {
            "name": "status",
            "docs": [
              "0 Pending, 1 Allow, 2 Deny, 3 Review"
            ],
            "type": "u8"
          },
          {
            "name": "confidenceBps",
            "docs": [
              "0..10000"
            ],
            "type": "u16"
          },
          {
            "name": "flags",
            "docs": [
              "Bitmask, see docs/INTERFACES.md section 4."
            ],
            "type": "u32"
          },
          {
            "name": "unusedSqft",
            "type": "u64"
          },
          {
            "name": "estValueUsd",
            "docs": [
              "Whole dollars."
            ],
            "type": "u64"
          },
          {
            "name": "reportHash",
            "docs": [
              "sha256 of the LLM JSON report."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "source",
            "docs": [
              "0 Manual (registrar), 1 CRE (forwarder)"
            ],
            "type": "u8"
          },
          {
            "name": "requester",
            "type": "pubkey"
          },
          {
            "name": "requestedAt",
            "type": "i64"
          },
          {
            "name": "recordedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "verdictRecorded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bbl",
            "type": "string"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "source",
            "type": "u8"
          },
          {
            "name": "confidenceBps",
            "type": "u16"
          },
          {
            "name": "flags",
            "type": "u32"
          },
          {
            "name": "unusedSqft",
            "type": "u64"
          },
          {
            "name": "estValueUsd",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
