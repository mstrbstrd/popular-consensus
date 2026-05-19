import { prisma } from "@pc/db";
import { createFileArtifactStorage, hashJson, withArtifactSchema } from "@pc/artifacts";
import { createCoordinatorKeypair } from "@pc/privacy";
import { config } from "./config";

const artifactStore = createFileArtifactStorage(config.artifactDir);

const BC_MUNICIPALITIES = [
  { id: "community-bc-100-mile-house", slug: "100-mile-house", name: "100 Mile House", type: "District" },
  { id: "community-bc-abbotsford", slug: "abbotsford", name: "Abbotsford", type: "City" },
  { id: "community-bc-alert-bay", slug: "alert-bay", name: "Alert Bay", type: "Village" },
  { id: "community-bc-anmore", slug: "anmore", name: "Anmore", type: "Village" },
  { id: "community-bc-armstrong", slug: "armstrong", name: "Armstrong", type: "City" },
  { id: "community-bc-ashcroft", slug: "ashcroft", name: "Ashcroft", type: "Village" },
  { id: "community-bc-barriere", slug: "barriere", name: "Barriere", type: "District" },
  { id: "community-bc-belcarra", slug: "belcarra", name: "Belcarra", type: "Village" },
  { id: "community-bc-bowen-island", slug: "bowen-island", name: "Bowen Island", type: "Island Municipality" },
  { id: "community-bc-burnaby", slug: "burnaby", name: "Burnaby", type: "City" },
  { id: "community-bc-burns-lake", slug: "burns-lake", name: "Burns Lake", type: "Village" },
  { id: "community-bc-cache-creek", slug: "cache-creek", name: "Cache Creek", type: "Village" },
  { id: "community-bc-campbell-river", slug: "campbell-river", name: "Campbell River", type: "City" },
  { id: "community-bc-canal-flats", slug: "canal-flats", name: "Canal Flats", type: "Village" },
  { id: "community-bc-castlegar", slug: "castlegar", name: "Castlegar", type: "City" },
  { id: "community-bc-central-saanich", slug: "central-saanich", name: "Central Saanich", type: "District" },
  { id: "community-bc-chase", slug: "chase", name: "Chase", type: "Village" },
  { id: "community-bc-chetwynd", slug: "chetwynd", name: "Chetwynd", type: "District" },
  { id: "community-bc-chilliwack", slug: "chilliwack", name: "Chilliwack", type: "City" },
  { id: "community-bc-clearwater", slug: "clearwater", name: "Clearwater", type: "District" },
  { id: "community-bc-clinton", slug: "clinton", name: "Clinton", type: "Village" },
  { id: "community-bc-coldstream", slug: "coldstream", name: "Coldstream", type: "District" },
  { id: "community-bc-colwood", slug: "colwood", name: "Colwood", type: "City" },
  { id: "community-bc-comox", slug: "comox", name: "Comox", type: "Town" },
  { id: "community-bc-coquitlam", slug: "coquitlam", name: "Coquitlam", type: "City" },
  { id: "community-bc-courtenay", slug: "courtenay", name: "Courtenay", type: "City" },
  { id: "community-bc-cranbrook", slug: "cranbrook", name: "Cranbrook", type: "City" },
  { id: "community-bc-creston", slug: "creston", name: "Creston", type: "Town" },
  { id: "community-bc-cumberland", slug: "cumberland", name: "Cumberland", type: "Village" },
  { id: "community-bc-dawson-creek", slug: "dawson-creek", name: "Dawson Creek", type: "City" },
  { id: "community-bc-delta", slug: "delta", name: "Delta", type: "District" },
  { id: "community-bc-duncan", slug: "duncan", name: "Duncan", type: "City" },
  { id: "community-bc-elkford", slug: "elkford", name: "Elkford", type: "District" },
  { id: "community-bc-enderby", slug: "enderby", name: "Enderby", type: "City" },
  { id: "community-bc-esquimalt", slug: "esquimalt", name: "Esquimalt", type: "Township" },
  { id: "community-bc-fernie", slug: "fernie", name: "Fernie", type: "City" },
  { id: "community-bc-fort-st-james", slug: "fort-st-james", name: "Fort St. James", type: "District" },
  { id: "community-bc-fort-st-john", slug: "fort-st-john", name: "Fort St. John", type: "City" },
  { id: "community-bc-fraser-lake", slug: "fraser-lake", name: "Fraser Lake", type: "Village" },
  { id: "community-bc-fruitvale", slug: "fruitvale", name: "Fruitvale", type: "Village" },
  { id: "community-bc-gibsons", slug: "gibsons", name: "Gibsons", type: "Town" },
  { id: "community-bc-gold-river", slug: "gold-river", name: "Gold River", type: "Village" },
  { id: "community-bc-golden", slug: "golden", name: "Golden", type: "Town" },
  { id: "community-bc-grand-forks", slug: "grand-forks", name: "Grand Forks", type: "City" },
  { id: "community-bc-granisle", slug: "granisle", name: "Granisle", type: "Village" },
  { id: "community-bc-greenwood", slug: "greenwood", name: "Greenwood", type: "City" },
  { id: "community-bc-harrison-hot-springs", slug: "harrison-hot-springs", name: "Harrison Hot Springs", type: "Village" },
  { id: "community-bc-hazelton", slug: "hazelton", name: "Hazelton", type: "Village" },
  { id: "community-bc-highlands", slug: "highlands", name: "Highlands", type: "District" },
  { id: "community-bc-hope", slug: "hope", name: "Hope", type: "District" },
  { id: "community-bc-houston", slug: "houston", name: "Houston", type: "District" },
  { id: "community-bc-hudsons-hope", slug: "hudsons-hope", name: "Hudson's Hope", type: "District" },
  { id: "community-bc-invermere", slug: "invermere", name: "Invermere", type: "District" },
  { id: "community-bc-kamloops", slug: "kamloops", name: "Kamloops", type: "City" },
  { id: "community-bc-kaslo", slug: "kaslo", name: "Kaslo", type: "Village" },
  { id: "community-bc-kelowna", slug: "kelowna", name: "Kelowna", type: "City" },
  { id: "community-bc-kent", slug: "kent", name: "Kent", type: "District" },
  { id: "community-bc-keremeos", slug: "keremeos", name: "Keremeos", type: "Village" },
  { id: "community-bc-kimberley", slug: "kimberley", name: "Kimberley", type: "City" },
  { id: "community-bc-kitimat", slug: "kitimat", name: "Kitimat", type: "District" },
  { id: "community-bc-ladysmith", slug: "ladysmith", name: "Ladysmith", type: "Town" },
  { id: "community-bc-lake-country", slug: "lake-country", name: "Lake Country", type: "District" },
  { id: "community-bc-lake-cowichan", slug: "lake-cowichan", name: "Lake Cowichan", type: "Town" },
  { id: "community-bc-langford", slug: "langford", name: "Langford", type: "City" },
  { id: "community-bc-langley-city", slug: "langley-city", name: "Langley", type: "City" },
  { id: "community-bc-langley-township", slug: "langley-township", name: "Langley", type: "Township" },
  { id: "community-bc-lantzville", slug: "lantzville", name: "Lantzville", type: "District" },
  { id: "community-bc-lillooet", slug: "lillooet", name: "Lillooet", type: "District" },
  { id: "community-bc-lions-bay", slug: "lions-bay", name: "Lions Bay", type: "Village" },
  { id: "community-bc-logan-lake", slug: "logan-lake", name: "Logan Lake", type: "District" },
  { id: "community-bc-lumby", slug: "lumby", name: "Lumby", type: "Village" },
  { id: "community-bc-lytton", slug: "lytton", name: "Lytton", type: "Village" },
  { id: "community-bc-mackenzie", slug: "mackenzie", name: "Mackenzie", type: "District" },
  { id: "community-bc-maple-ridge", slug: "maple-ridge", name: "Maple Ridge", type: "City" },
  { id: "community-bc-masset", slug: "masset", name: "Masset", type: "Village" },
  { id: "community-bc-mcbride", slug: "mcbride", name: "McBride", type: "Village" },
  { id: "community-bc-merritt", slug: "merritt", name: "Merritt", type: "City" },
  { id: "community-bc-metchosin", slug: "metchosin", name: "Metchosin", type: "District" },
  { id: "community-bc-midway", slug: "midway", name: "Midway", type: "Village" },
  { id: "community-bc-mission", slug: "mission", name: "Mission", type: "District" },
  { id: "community-bc-montrose", slug: "montrose", name: "Montrose", type: "Village" },
  { id: "community-bc-nakusp", slug: "nakusp", name: "Nakusp", type: "Village" },
  { id: "community-bc-nanaimo", slug: "nanaimo", name: "Nanaimo", type: "City" },
  { id: "community-bc-nelson", slug: "nelson", name: "Nelson", type: "City" },
  { id: "community-bc-new-denver", slug: "new-denver", name: "New Denver", type: "Village" },
  { id: "community-bc-new-hazelton", slug: "new-hazelton", name: "New Hazelton", type: "District" },
  { id: "community-bc-new-westminster", slug: "new-westminster", name: "New Westminster", type: "City" },
  { id: "community-bc-north-cowichan", slug: "north-cowichan", name: "North Cowichan", type: "District" },
  { id: "community-bc-north-saanich", slug: "north-saanich", name: "North Saanich", type: "District" },
  { id: "community-bc-north-vancouver-city", slug: "north-vancouver-city", name: "North Vancouver", type: "City" },
  { id: "community-bc-north-vancouver-district", slug: "north-vancouver-district", name: "North Vancouver", type: "District" },
  { id: "community-bc-northern-rockies", slug: "northern-rockies", name: "Northern Rockies", type: "Regional Municipality" },
  { id: "community-bc-oak-bay", slug: "oak-bay", name: "Oak Bay", type: "District" },
  { id: "community-bc-oliver", slug: "oliver", name: "Oliver", type: "Town" },
  { id: "community-bc-osoyoos", slug: "osoyoos", name: "Osoyoos", type: "Town" },
  { id: "community-bc-parksville", slug: "parksville", name: "Parksville", type: "City" },
  { id: "community-bc-peachland", slug: "peachland", name: "Peachland", type: "District" },
  { id: "community-bc-pemberton", slug: "pemberton", name: "Pemberton", type: "Village" },
  { id: "community-bc-penticton", slug: "penticton", name: "Penticton", type: "City" },
  { id: "community-bc-pitt-meadows", slug: "pitt-meadows", name: "Pitt Meadows", type: "City" },
  { id: "community-bc-port-alberni", slug: "port-alberni", name: "Port Alberni", type: "City" },
  { id: "community-bc-port-alice", slug: "port-alice", name: "Port Alice", type: "Village" },
  { id: "community-bc-port-clements", slug: "port-clements", name: "Port Clements", type: "Village" },
  { id: "community-bc-port-coquitlam", slug: "port-coquitlam", name: "Port Coquitlam", type: "City" },
  { id: "community-bc-port-edward", slug: "port-edward", name: "Port Edward", type: "District" },
  { id: "community-bc-port-hardy", slug: "port-hardy", name: "Port Hardy", type: "District" },
  { id: "community-bc-port-mcneill", slug: "port-mcneill", name: "Port McNeill", type: "Town" },
  { id: "community-bc-port-moody", slug: "port-moody", name: "Port Moody", type: "City" },
  { id: "community-bc-pouce-coupe", slug: "pouce-coupe", name: "Pouce Coupe", type: "Village" },
  { id: "community-bc-powell-river", slug: "powell-river", name: "Powell River", type: "City" },
  { id: "community-bc-prince-george", slug: "prince-george", name: "Prince George", type: "City" },
  { id: "community-bc-prince-rupert", slug: "prince-rupert", name: "Prince Rupert", type: "City" },
  { id: "community-bc-princeton", slug: "princeton", name: "Princeton", type: "Town" },
  { id: "community-bc-qualicum-beach", slug: "qualicum-beach", name: "Qualicum Beach", type: "Town" },
  { id: "community-bc-queen-charlotte", slug: "queen-charlotte", name: "Queen Charlotte", type: "Village" },
  { id: "community-bc-quesnel", slug: "quesnel", name: "Quesnel", type: "City" },
  { id: "community-bc-radium-hot-springs", slug: "radium-hot-springs", name: "Radium Hot Springs", type: "Village" },
  { id: "community-bc-revelstoke", slug: "revelstoke", name: "Revelstoke", type: "City" },
  { id: "community-bc-richmond", slug: "richmond", name: "Richmond", type: "City" },
  { id: "community-bc-rossland", slug: "rossland", name: "Rossland", type: "City" },
  { id: "community-bc-saanich", slug: "saanich", name: "Saanich", type: "District" },
  { id: "community-bc-salmo", slug: "salmo", name: "Salmo", type: "Village" },
  { id: "community-bc-salmon-arm", slug: "salmon-arm", name: "Salmon Arm", type: "City" },
  { id: "community-bc-sayward", slug: "sayward", name: "Sayward", type: "Village" },
  { id: "community-bc-sechelt-district", slug: "sechelt-district", name: "Sechelt", type: "District" },
  { id: "community-bc-sechelt-indian-government-district", slug: "sechelt-indian-government-district", name: "Sechelt", type: "Indian Government District" },
  { id: "community-bc-sicamous", slug: "sicamous", name: "Sicamous", type: "District" },
  { id: "community-bc-sidney", slug: "sidney", name: "Sidney", type: "Town" },
  { id: "community-bc-silverton", slug: "silverton", name: "Silverton", type: "Village" },
  { id: "community-bc-slocan", slug: "slocan", name: "Slocan", type: "Village" },
  { id: "community-bc-smithers", slug: "smithers", name: "Smithers", type: "Town" },
  { id: "community-bc-sooke", slug: "sooke", name: "Sooke", type: "District" },
  { id: "community-bc-spallumcheen", slug: "spallumcheen", name: "Spallumcheen", type: "Township" },
  { id: "community-bc-sparwood", slug: "sparwood", name: "Sparwood", type: "District" },
  { id: "community-bc-squamish", slug: "squamish", name: "Squamish", type: "District" },
  { id: "community-bc-stewart", slug: "stewart", name: "Stewart", type: "District" },
  { id: "community-bc-summerland", slug: "summerland", name: "Summerland", type: "District" },
  { id: "community-bc-sun-peaks", slug: "sun-peaks", name: "Sun Peaks", type: "Mountain Resort Municipality" },
  { id: "community-bc-surrey", slug: "surrey", name: "Surrey", type: "City" },
  { id: "community-bc-tahsis", slug: "tahsis", name: "Tahsis", type: "Village" },
  { id: "community-bc-taylor", slug: "taylor", name: "Taylor", type: "District" },
  { id: "community-bc-telkwa", slug: "telkwa", name: "Telkwa", type: "Village" },
  { id: "community-bc-terrace", slug: "terrace", name: "Terrace", type: "City" },
  { id: "community-bc-tofino", slug: "tofino", name: "Tofino", type: "District" },
  { id: "community-bc-trail", slug: "trail", name: "Trail", type: "City" },
  { id: "community-bc-tumbler-ridge", slug: "tumbler-ridge", name: "Tumbler Ridge", type: "District" },
  { id: "community-bc-ucluelet", slug: "ucluelet", name: "Ucluelet", type: "District" },
  { id: "community-bc-valemount", slug: "valemount", name: "Valemount", type: "Village" },
  { id: "community-vancouver-city", slug: "vancouver", name: "Vancouver", type: "City" },
  { id: "community-bc-vanderhoof", slug: "vanderhoof", name: "Vanderhoof", type: "District" },
  { id: "community-bc-vernon", slug: "vernon", name: "Vernon", type: "City" },
  { id: "community-bc-victoria", slug: "victoria", name: "Victoria", type: "City" },
  { id: "community-bc-view-royal", slug: "view-royal", name: "View Royal", type: "Town" },
  { id: "community-bc-warfield", slug: "warfield", name: "Warfield", type: "Village" },
  { id: "community-bc-wells", slug: "wells", name: "Wells", type: "District" },
  { id: "community-bc-west-kelowna", slug: "west-kelowna", name: "West Kelowna", type: "City" },
  { id: "community-bc-west-vancouver", slug: "west-vancouver", name: "West Vancouver", type: "District" },
  { id: "community-bc-whistler", slug: "whistler", name: "Whistler", type: "Resort Municipality" },
  { id: "community-bc-white-rock", slug: "white-rock", name: "White Rock", type: "City" },
  { id: "community-bc-williams-lake", slug: "williams-lake", name: "Williams Lake", type: "City" },
  { id: "community-bc-zeballos", slug: "zeballos", name: "Zeballos", type: "Village" }
];

export async function ensureSeedData() {
  const body = {
    title: "Should Vancouver pilot car-free Sundays on Commercial Drive?",
    body: "A city resident advisory poll on whether to pilot car-free Sundays on Commercial Drive for one summer season."
  };
  const sponsor = {
    sponsor: "Popular Consensus local transit demo fund",
    disclosure: "Demo-only sponsor disclosure. No real-world authority is implied."
  };
  const bodyArtifact = await artifactStore.write(withArtifactSchema("question-body", body));
  const sponsorArtifact = await artifactStore.write(withArtifactSchema("sponsor-disclosure", sponsor));

  await prisma.artifact.upsert({
    where: { hash: bodyArtifact.hash },
    update: {},
    create: { hash: bodyArtifact.hash, path: bodyArtifact.path, kind: "question-body" }
  });
  await prisma.artifact.upsert({
    where: { hash: sponsorArtifact.hash },
    update: {},
    create: { hash: sponsorArtifact.hash, path: sponsorArtifact.path, kind: "sponsor-disclosure" }
  });

  const demoUsers = [
    { id: "demo-proposer", username: "demo_proposer", displayName: "Demo Proposer", bio: "Local account for creating civic questions." },
    { id: "demo-challenger", username: "demo_challenger", displayName: "Demo Challenger", bio: "Local account for challenging misleading wording." },
    { id: "demo-curator", username: "demo_curator", displayName: "Demo Curator", bio: "Local account for registry curation and challenge rulings." },
    { id: "demo-resident", username: "demo_resident", displayName: "Demo Resident", bio: "Local account for private resident responses." }
  ];
  for (const user of demoUsers) {
    const profileId = portableProfileId(user.id);
    const profileArtifact = await artifactStore.write(
      withArtifactSchema("user-profile", {
        profileId,
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio
      })
    );
    await prisma.artifact.upsert({
      where: { hash: profileArtifact.hash },
      update: {},
      create: { hash: profileArtifact.hash, path: profileArtifact.path, kind: "user-profile" }
    });
    await prisma.userAccount.upsert({
      where: { id: user.id },
      update: { ...user, profileId, profileHash: profileArtifact.hash },
      create: { ...user, profileId, profileHash: profileArtifact.hash }
    });
    await ensureProfileCommunityForUser(user.id, user.username, user.displayName, user.bio);
  }

  const geographyCommunities = [
    {
      id: "community-world",
      slug: "world",
      name: "World",
      description: "Root public directory for physical and digital communities.",
      parentId: null,
      path: "world",
      depth: 0
    },
    {
      id: "community-canada",
      slug: "canada",
      name: "Canada",
      description: "Country-level community for Canadian public questions and child communities.",
      parentId: "community-world",
      path: "world/canada",
      depth: 1
    },
    ...[
      ["alberta", "Alberta"],
      ["british-columbia", "British Columbia"],
      ["manitoba", "Manitoba"],
      ["new-brunswick", "New Brunswick"],
      ["newfoundland-and-labrador", "Newfoundland and Labrador"],
      ["northwest-territories", "Northwest Territories"],
      ["nova-scotia", "Nova Scotia"],
      ["nunavut", "Nunavut"],
      ["ontario", "Ontario"],
      ["prince-edward-island", "Prince Edward Island"],
      ["quebec", "Quebec"],
      ["saskatchewan", "Saskatchewan"],
      ["yukon", "Yukon"]
    ].map(([slug, name]) => ({
      id: `community-canada-${slug}`,
      slug,
      name,
      description:
        slug === "british-columbia"
          ? "Province-level community for British Columbia, seeded with all 161 current incorporated municipalities as direct child communities."
          : `${name} community directory under Canada.`,
      parentId: "community-canada",
      path: `world/canada/${slug}`,
      depth: 2
    })),
    ...BC_MUNICIPALITIES.map((municipality) => ({
      id: municipality.id,
      slug: municipality.slug,
      name: municipality.name,
      description: `${municipality.type}-level community in British Columbia.`,
      parentId: "community-canada-british-columbia",
      path: `world/canada/british-columbia/${municipality.slug}`,
      depth: 3
    }))
  ];

  for (const community of geographyCommunities) {
    await prisma.community.upsert({
      where: { id: community.id },
      update: {
        slug: community.slug,
        name: community.name,
        description: community.description,
        parentId: community.parentId,
        path: community.path,
        depth: community.depth,
        registryStatus: "Active"
      },
      create: {
        ...community,
        visibility: "Public",
        registryStatus: "Active",
        credentialSchemaId: "credential-vancouver-resident",
        defaultAuthorityLevel: "Advisory",
        createdBy: "demo-curator"
      }
    });
    await prisma.communityRegistryPolicy.upsert({
      where: { communityId: community.id },
      update: { approvalThresholdPercent: 66, quorumPercent: 10, reviewWindowHours: 168, status: "Active" },
      create: {
        id: `registry-policy-${community.id}`,
        communityId: community.id,
        approvalThresholdPercent: 66,
        quorumPercent: 10,
        reviewWindowHours: 168,
        createdBy: "demo-curator"
      }
    });
  }

  await prisma.community.upsert({
    where: { id: "community-vancouver" },
    update: {
      parentId: "community-vancouver-city",
      path: "world/canada/british-columbia/vancouver/vancouver-transit",
      depth: 4,
      registryStatus: "Active"
    },
    create: {
      id: "community-vancouver",
      slug: "vancouver-transit",
      name: "Vancouver Transit",
      description: "Public civic questions about transit, streets, and public space.",
      parentId: "community-vancouver-city",
      path: "world/canada/british-columbia/vancouver/vancouver-transit",
      depth: 4,
      registryStatus: "Active",
      visibility: "Public",
      credentialSchemaId: "credential-vancouver-resident",
      defaultAuthorityLevel: "Advisory",
      createdBy: "demo-proposer"
    }
  });

  await prisma.community.upsert({
    where: { id: "community-housing-coop" },
    update: {
      parentId: "community-vancouver-city",
      path: "world/canada/british-columbia/vancouver/east-van-coop",
      depth: 4,
      registryStatus: "Active"
    },
    create: {
      id: "community-housing-coop",
      slug: "east-van-coop",
      name: "East Van Housing Co-op",
      description: "Private member space for housing co-op governance practice.",
      parentId: "community-vancouver-city",
      path: "world/canada/british-columbia/vancouver/east-van-coop",
      depth: 4,
      registryStatus: "Active",
      visibility: "Private",
      credentialSchemaId: "credential-vancouver-resident",
      defaultAuthorityLevel: "Advisory",
      createdBy: "demo-resident"
    }
  });

  const demoMemberships = [
    { communityId: "community-vancouver", userId: "demo-proposer", role: "Owner" },
    { communityId: "community-vancouver", userId: "demo-challenger", role: "Member" },
    { communityId: "community-vancouver", userId: "demo-curator", role: "Moderator" },
    { communityId: "community-vancouver", userId: "demo-resident", role: "Member" },
    { communityId: "community-housing-coop", userId: "demo-resident", role: "Owner" },
    { communityId: "community-world", userId: "demo-curator", role: "Owner" },
    { communityId: "community-canada", userId: "demo-curator", role: "Owner" },
    { communityId: "community-canada-british-columbia", userId: "demo-curator", role: "Owner" },
    { communityId: "community-vancouver-city", userId: "demo-curator", role: "Owner" }
  ];
  for (const membership of demoMemberships) {
    await prisma.communityMember.upsert({
      where: { communityId_userId: { communityId: membership.communityId, userId: membership.userId } },
      update: { role: membership.role, status: "Active" },
      create: {
        id: `member-${membership.communityId}-${membership.userId}`,
        communityId: membership.communityId,
        userId: membership.userId,
        role: membership.role,
        status: "Active"
      }
    });
    await ensureMembershipSource(membership.communityId, membership.userId, "DirectJoin", `direct:${membership.communityId}`, membership.communityId);
    await propagateSeedMembershipToAncestors(membership.communityId, membership.userId);
  }

  await prisma.credentialIssuer.upsert({
    where: { id: "issuer-demo-resident" },
    update: {},
    create: {
      id: "issuer-demo-resident",
      publicKey: "dev-issuer-public-key",
      schemaIds: ["credential-vancouver-resident"],
      metadataHash: hashJson({ name: "Demo Vancouver Resident Issuer" }),
      status: "Active"
    }
  });

  await prisma.credentialSchema.upsert({
    where: { id: "credential-vancouver-resident" },
    update: {
      name: "Demo Vancouver Resident",
      issuerRegistryId: "issuer-registry-demo",
      eligibilityClaimHash: hashJson({ claim: "Local demo resident or community member" }),
      nullifierDomainRule: "H(secret, pollId, credentialSchemaId)",
      status: "Active"
    },
    create: {
      id: "credential-vancouver-resident",
      name: "Demo Vancouver Resident",
      issuerRegistryId: "issuer-registry-demo",
      eligibilityClaimHash: hashJson({ claim: "Local demo resident or community member" }),
      nullifierDomainRule: "H(secret, pollId, credentialSchemaId)",
      status: "Active"
    }
  });

  const advisoryPolicyProposalArtifact = await artifactStore.write(
    withArtifactSchema("adoption-policy-proposal", {
      communityId: "community-vancouver",
      authorityLevel: "Advisory",
      eligibleQuestionTypes: ["transit"],
      credentialSchemaIds: ["credential-vancouver-resident"],
      rule: "Seeded demo advisory policy"
    })
  );
  const advisoryPolicyActivationArtifact = await artifactStore.write(
    withArtifactSchema("adoption-policy-activation", {
      communityId: "community-vancouver",
      policyId: "policy-vancouver-advisory",
      activatedBy: "system-seed",
      adoptionRecord: "Seeded demo advisory policy is active by default.",
      effectiveAt: 0
    })
  );
  await prisma.artifact.upsert({
    where: { hash: advisoryPolicyProposalArtifact.hash },
    update: {},
    create: { hash: advisoryPolicyProposalArtifact.hash, path: advisoryPolicyProposalArtifact.path, kind: "adoption-policy-proposal" }
  });
  await prisma.artifact.upsert({
    where: { hash: advisoryPolicyActivationArtifact.hash },
    update: {},
    create: { hash: advisoryPolicyActivationArtifact.hash, path: advisoryPolicyActivationArtifact.path, kind: "adoption-policy-activation" }
  });
  const advisoryPolicyRuleHashes = {
    quorumRuleHash: hashJson({ rule: "No quorum for demo advisory poll" }),
    approvalRuleHash: hashJson({ rule: "Simple aggregate display only" }),
    forkRuleHash: hashJson({ rule: "Community may fork metadata and archive references" })
  };
  await prisma.adoptionPolicy.upsert({
    where: { id: "policy-vancouver-advisory" },
    update: {
      authorityLevel: "Advisory",
      eligibleQuestionTypes: ["transit"],
      credentialSchemaIds: ["credential-vancouver-resident"],
      ...advisoryPolicyRuleHashes,
      proposalHash: advisoryPolicyProposalArtifact.hash,
      activationHash: advisoryPolicyActivationArtifact.hash,
      proposedBy: "system-seed",
      adoptedBy: "system-seed",
      status: "Active"
    },
    create: {
      id: "policy-vancouver-advisory",
      communityId: "community-vancouver",
      authorityLevel: "Advisory",
      eligibleQuestionTypes: ["transit"],
      credentialSchemaIds: ["credential-vancouver-resident"],
      ...advisoryPolicyRuleHashes,
      proposalHash: advisoryPolicyProposalArtifact.hash,
      activationHash: advisoryPolicyActivationArtifact.hash,
      proposedBy: "system-seed",
      adoptedBy: "system-seed",
      effectiveAt: new Date()
    }
  });

  const existing = await prisma.question.findUnique({ where: { id: "question-transit-demo" } });
  if (!existing) {
    const coordinator = createCoordinatorKeypair();
    await prisma.question.create({
      data: {
        id: "question-transit-demo",
        title: body.title,
        bodyHash: bodyArtifact.hash,
        answerSchemaId: "answer-binary-support-oppose",
        credentialSchemaId: "credential-vancouver-resident",
        communityId: "community-vancouver",
        audience: "Public",
        topicIds: ["transit", "public-space"],
        geoScope: "Vancouver",
        sponsorDisclosureHash: sponsorArtifact.hash,
        methodologyLabel: "Answered by city residents who chose to take part",
        authorityLevel: "Advisory",
        opensAt: new Date(),
        closesAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        challengeWindowEndsAt: new Date(Date.now() + 1000 * 60 * 60),
        proposer: "demo-proposer",
        proposalBondId: "bond-demo-proposal",
        status: "Submitted",
        poll: {
          create: {
            id: "poll-transit-demo",
            status: "Configured",
            tallyPublicKeyId: coordinator.publicKeyId,
            tallyPublicKeyPem: coordinator.publicKeyPem,
            tallyPrivateKeyPem: coordinator.privateKeyPem,
            credentialSchemaId: "credential-vancouver-resident",
            privacyThreshold: 1,
            resultChallengeEndsAt: new Date(Date.now() + 1000 * 60 * 60 * 25)
          }
        }
      }
    });
    const seedTransaction = buildSeedProtocolTransactionResult("QuestionSubmitted", "question-transit-demo", "demo-proposer", null, bodyArtifact.hash);
    await prisma.protocolTransactionResult.create({
      data: {
        id: seedTransaction.id,
        sourceType: seedTransaction.sourceType,
        sourceModule: seedTransaction.sourceModule,
        transactionType: seedTransaction.transactionType,
        subjectId: "question-transit-demo",
        actor: "demo-proposer",
        eventType: "QuestionSubmitted",
        eventHash: seedTransaction.eventHash,
        resultHash: seedTransaction.resultHash,
        payloadHash: seedTransaction.payloadHash,
        payloadJson: JSON.stringify(seedTransaction.payload),
        status: "Applied",
        createdAt: seedTransaction.emittedAt
      }
    });
    await prisma.registryEvent.create({
      data: {
        id: seedTransaction.eventHash,
        eventType: "QuestionSubmitted",
        subjectId: "question-transit-demo",
        actor: "demo-proposer",
        newHash: bodyArtifact.hash,
        sourceType: seedTransaction.sourceType,
        sourceTransactionId: seedTransaction.id,
        sourceTransactionHash: seedTransaction.resultHash,
        sourceModule: seedTransaction.sourceModule,
        transactionType: seedTransaction.transactionType,
        emittedAt: seedTransaction.emittedAt
      }
    });
  }

  await prisma.question.update({
    where: { id: "question-transit-demo" },
    data: { proposalBondId: "bond-demo-proposal", status: "Submitted" }
  });
  await prisma.poll.updateMany({
    where: { questionId: "question-transit-demo" },
    data: { status: "Configured" }
  });
  await prisma.bond.upsert({
    where: { id: "bond-demo-proposal" },
    update: {
      owner: "demo-proposer",
      questionId: "question-transit-demo",
      amountPc: 100,
      bondType: "Proposal",
      status: "Escrowed",
      slashedPc: 0,
      refundedPc: 0,
      rewardPc: 0,
      treasuryPc: 0,
      settledAt: null
    },
    create: {
      id: "bond-demo-proposal",
      owner: "demo-proposer",
      questionId: "question-transit-demo",
      amountPc: 100,
      bondType: "Proposal"
    }
  });
}

export async function resetDemoData() {
  await prisma.archiveRecord.deleteMany();
  await prisma.jurorAssignment.deleteMany();
  await prisma.challengeAppeal.deleteMany();
  await prisma.resultChallenge.deleteMany();
  await prisma.discussionModerationAppeal.deleteMany();
  await prisma.discussionModerationRecord.deleteMany();
  await prisma.discussionPost.deleteMany();
  await prisma.activityFeedItem.deleteMany();
  await prisma.dataUnionClaim.deleteMany();
  await prisma.dataUnionSettlement.deleteMany();
  await prisma.dataUnionAccessGrant.deleteMany();
  await prisma.dataUnionBuyer.deleteMany();
  await prisma.dataUnionProduct.deleteMany();
  await prisma.dataUnionConsent.deleteMany();
  await prisma.dataUnionPolicy.deleteMany();
  await prisma.result.deleteMany();
  await prisma.ballot.deleteMany();
  await prisma.participationReceipt.deleteMany();
  await prisma.tallyDecryptionShare.deleteMany();
  await prisma.poll.deleteMany();
  await prisma.bond.deleteMany();
  await prisma.reputationEvent.deleteMany();
  await prisma.challenge.deleteMany();
  await prisma.question.deleteMany();
  await prisma.topicFollow.deleteMany();
  await prisma.communityFollow.deleteMany();
  await prisma.communityChildProposalVote.deleteMany();
  await prisma.communityChildProposal.deleteMany();
  await prisma.communityMembershipSource.deleteMany();
  await prisma.communityMember.deleteMany();
  await prisma.communityRegistryPolicy.deleteMany();
  await prisma.communityFork.deleteMany();
  await prisma.communityFrontendConfig.deleteMany();
  await prisma.communityEmergencySuspension.deleteMany();
  await prisma.communityCredentialTrustPolicy.deleteMany();
  await prisma.tallyKeySetup.deleteMany();
  await prisma.tallyCommittee.deleteMany();
  await prisma.governanceParameterSet.deleteMany();
  await prisma.community.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.authChallenge.deleteMany();
  await prisma.authController.deleteMany();
  await prisma.userAccount.deleteMany();
  await prisma.credentialRevocation.deleteMany();
  await prisma.credential.deleteMany();
  await prisma.credentialIssuer.deleteMany();
  await prisma.credentialSchema.deleteMany();
  await prisma.adoptionPolicy.deleteMany();
  await prisma.protocolCommitmentRecord.deleteMany();
  await prisma.protocolTransactionResult.deleteMany();
  await prisma.registryEvent.deleteMany();
  await prisma.artifact.deleteMany();
  await ensureSeedData();
}

function buildSeedProtocolTransactionResult(eventType: string, subjectId: string, actor: string, previousHash: string | null, newHash: string) {
  const emittedAt = new Date();
  const sourceType = "local-devnet";
  const sourceModule = "QuestionRegistry";
  const transactionType = "questionSubmitted";
  const eventHash = hashJson({ eventType, subjectId, actor, previousHash, newHash, emittedAt: emittedAt.toISOString(), seed: true });
  const payload = {
    protocol: "popular-consensus",
    schemaVersion: "local-protocol-transaction-result-v0",
    sourceType,
    sourceModule,
    transactionType,
    subjectId,
    actor,
    eventType,
    previousHash,
    newHash,
    eventHash,
    emittedAt: emittedAt.toISOString(),
    seed: true
  };
  const payloadHash = hashJson(payload);
  const resultHash = hashJson({ sourceType, sourceModule, transactionType, eventHash, payloadHash });
  return {
    id: hashJson({ sourceType, sourceModule, transactionType, subjectId, eventHash }),
    sourceType,
    sourceModule,
    transactionType,
    eventHash,
    resultHash,
    payloadHash,
    payload,
    emittedAt
  };
}

function portableProfileId(userId: string) {
  return `did:pc:${userId}`;
}

async function ensureMembershipSource(
  communityId: string,
  userId: string,
  sourceType: string,
  sourceKey: string,
  sourceCommunityId: string | null
) {
  await prisma.communityMembershipSource.upsert({
    where: { communityId_userId_sourceKey: { communityId, userId, sourceKey } },
    update: { sourceType, sourceCommunityId, status: "Active" },
    create: {
      id: `membership-source-${communityId}-${userId}-${sourceKey}`.replace(/[^a-zA-Z0-9:_-]/g, "-").slice(0, 120),
      communityId,
      userId,
      sourceType,
      sourceKey,
      sourceCommunityId,
      status: "Active"
    }
  });
}

async function propagateSeedMembershipToAncestors(joinedCommunityId: string, userId: string) {
  const seen = new Set<string>();
  let current = await prisma.community.findUnique({ where: { id: joinedCommunityId }, select: { parentId: true } });
  while (current?.parentId && !seen.has(current.parentId)) {
    seen.add(current.parentId);
    const parent = await prisma.community.findUnique({ where: { id: current.parentId }, select: { id: true, parentId: true } });
    if (!parent) break;
    await prisma.communityMember.upsert({
      where: { communityId_userId: { communityId: parent.id, userId } },
      update: { status: "Active" },
      create: {
        id: `member-${parent.id}-${userId}`,
        communityId: parent.id,
        userId,
        role: "Member",
        status: "Active"
      }
    });
    await ensureMembershipSource(parent.id, userId, "ChildCommunity", `child:${joinedCommunityId}`, joinedCommunityId);
    current = parent;
  }
}

async function ensureProfileCommunityForUser(userId: string, username: string, displayName: string, bio?: string | null) {
  const communityId = profileCommunityIdForUser(userId);
  await prisma.community.upsert({
    where: { id: communityId },
    update: {
      name: displayName,
      description: bio || `${displayName}'s personal question feed.`,
      profileUserId: userId,
      kind: "Profile",
      visibility: "Public",
      path: profileCommunitySlug(username),
      depth: 0,
      registryStatus: "Active"
    },
    create: {
      id: communityId,
      slug: profileCommunitySlug(username),
      name: displayName,
      description: bio || `${displayName}'s personal question feed.`,
      kind: "Profile",
      path: profileCommunitySlug(username),
      depth: 0,
      registryStatus: "Active",
      profileUserId: userId,
      visibility: "Public",
      credentialSchemaId: "credential-vancouver-resident",
      defaultAuthorityLevel: "Advisory",
      createdBy: userId
    }
  });
  await prisma.communityMember.upsert({
    where: { communityId_userId: { communityId, userId } },
    update: { role: "Owner", status: "Active" },
    create: {
      id: `member-${communityId}-${userId}`,
      communityId,
      userId,
      role: "Owner",
      status: "Active"
    }
  });
  await ensureMembershipSource(communityId, userId, "DirectJoin", `direct:${communityId}`, communityId);
  await prisma.userAccount.update({
    where: { id: userId },
    data: { profileCommunityId: communityId }
  });
}

function profileCommunityIdForUser(userId: string) {
  return `community-profile-${userId.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase()}`;
}

function profileCommunitySlug(username: string) {
  return `user-${username.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")}`;
}
