import axios from "axios";
import { useEffect, useState } from "react";
import { redirect, useFetcher, useLoaderData, type LoaderFunctionArgs } from "react-router";
import CurrentLocationCard from "~/components/current-location-card";
import EmptyListIcon from "~/components/empty-list";
import EndListIcon from "~/components/end-of-list";
import GapController from "~/components/gap-control";
import LongShopCard from "~/components/long-shop-card";
import NearbyShopCard from "~/components/nearby-shop-card";
import QueueCardWaiting from "~/components/queue-card-waiting";
import ScrollToTopButton from "~/components/scroll-to-top-button";
import SearchBar from "~/components/search-bar";
import WelcomeUser from "~/components/welcome-user";
import XAxisSlide from "~/components/x-axis-slide";
import { DataCenter } from "~/provider/datacenter";
import { fetchQueueWaiting } from "~/repositories/queue.repository";
import { getShopsInfo } from "~/repositories/shop.repository";
import type { QueueWaitings } from "~/types/queue";
import { calculateDistance } from "~/utils/location";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const shops: Shop[] = await getShopsInfo(request);
    const name: string = DataCenter.getData("user_name_info") as string;
    const queueWaitings: QueueWaitings = await fetchQueueWaiting(request);

    return {
      shops,
      name,
      queueWaitings: queueWaitings,
    };
  } catch (e) {
    return {
      shops: [],
      name: "",
      queueWaitings: { data: [] },
    };
  }
}

interface LocationData {
  success: boolean;
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  address?: any;
  error?: string;
}

export async function action({ request }: LoaderFunctionArgs) {
  const formData = await request.formData();
  const queueId = formData.get("queueId") as string;

  try {
    console.log(`Queue action performed on queue ${queueId}`);
    return redirect(`/queue/${queueId}`);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}

function HomePage() {
  const { shops, name, queueWaitings } = useLoaderData<typeof loader>();
  const filteredShops = shops;
  const fetcher = useFetcher();

  const [userLocation, setUserLocation] = useState<LocationData>({ success: false });
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [distances, setDistances] = useState<{ [id: string]: string }>({});

  const handleQueueClick = (queueId: number) => {
    const formData = new FormData();
    formData.append("queueId", `${queueId}`);
    fetcher.submit(formData, { method: "post" });
  };

  useEffect(() => {
    async function a() {
      try {
        const latitude = 13.8479786;
        const longitude = 100.5697013;
        const response = await axios.get(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
        );

        const locationData = {
          success: true,
          lat: String(latitude),
          lon: String(longitude),
          name: response.data.name,
          display_name: response.data.display_name,
          address: response.data.address,
        };

        setUserLocation(locationData);
        if (filteredShops.length > 0) {
          const newDistances: { [id: string]: string } = {};
          const shopsWithDistances = filteredShops.map(shop => {
            const distance = calculateDistance(
              latitude,
              longitude,
              shop.latitude,
              shop.longitude
            );
            newDistances[shop.id] = `${distance.toFixed(2)} km`;
            return { ...shop, distance };
          });

          shopsWithDistances.sort((a, b) => a.distance - b.distance);

          setDistances(newDistances);
        }
      } catch (error) {
        setUserLocation({
          success: false,
          error: "ไม่สามารถดึงข้อมูลตำแหน่งได้",
        });
      } finally {
        setIsLoadingLocation(false);
      }
    }

    a();
  }, []);

  const sortedShops = filteredShops
    .map((shop) => ({
      ...shop,
      distance: parseFloat(distances[shop.id] || "0"),
    }))
    .sort((a, b) => {
      // Sort by is_open first (true comes before false)
      if (a.is_open !== b.is_open) {
        return a.is_open ? -1 : 1;
      }
      // If both shops have the same is_open value, then sort by distance
      return a.distance - b.distance;
    });

  return (
    <div className="overflow-x-hidden mt-[-1px]">
      <CurrentLocationCard
        isLoading={isLoadingLocation}
        locationName={userLocation.success ? userLocation.display_name : userLocation.error}
        lat={userLocation.lat}
        lon={userLocation.lon}
      />
      <div className="px-5 pb-16">
        <WelcomeUser userName={name}></WelcomeUser>

        <fetcher.Form method="post" className="w-full">
          {queueWaitings?.data?.length > 0 ? (
            <div className="space-y-4">
              {queueWaitings.data.map((queue, index) => (
                <div
                  key={index}
                  onClick={() => handleQueueClick(queue.queue_id)}
                  className="cursor-pointer hover:shadow-md transition-all rounded-lg"
                >
                  <QueueCardWaiting queue={queue} />
                </div>
              ))}
            </div>
          ) : (
            <div></div>
          )}
        </fetcher.Form>
        <GapController gap={55}>
          <div className="w-full mt-3">
            <GapController gap={15}>
              <h1 className="text-[20px] font-bold">ร้านค้าใกล้เคียงยอดนิยม</h1>
              {sortedShops.length === 0 ? (
                <EmptyListIcon />
              ) : (
                <div className="w-full overflow-x-visible">
                  <XAxisSlide>
                    {sortedShops.map((shop) => (
                      <NearbyShopCard
                        key={shop.id}
                        id={shop.id}
                        img_url={shop.image_url || "default-image.jpg"}
                        name={shop.name}
                        distance={`${shop.distance.toFixed(2)} km`}
                        is_open={shop.is_open}
                      />
                    ))}
                    <EndListIcon />
                  </XAxisSlide>
                </div>
              )}
            </GapController>
          </div>
          <div className="w-full">
            <GapController gap={15}>
              <h1 className="text-[20px] font-bold">ร้านค้าทั้งหมด</h1>
              {sortedShops.length === 0 ? (
                <EmptyListIcon />
              ) : (
                <>
                  {sortedShops.map((shop, index) => (
                    <LongShopCard
                      key={shop.id}
                      shop_id={shop.id}
                      img_url={shop.image_url || "default-image.jpg"}
                      name={shop.name}
                      distance={distances[shop.id] || ""}
                      total_queue={"30"}
                      is_open={shop.is_open}
                    />
                  ))}
                  <EndListIcon />
                </>
              )}
            </GapController>
          </div>
        </GapController>
      </div>
      <ScrollToTopButton />
    </div>
  );
}

export default HomePage;
