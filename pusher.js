let url = "https://pusher.qrisan.com/";
let title = "Pusher";

self.addEventListener("message", (event) => {
  /*
        Messages sent from amp-web-push have the format:
    
        - command: A string describing the message topic (e.g.
          'amp-web-push-subscribe')
    
        - payload: An optional JavaScript object containing extra data relevant to
          the command.
       */
  const { command } = event.data;

  switch (command) {
    case WorkerMessengerCommand.AMP_SUBSCRIPTION_STATE:
      onMessageReceivedSubscriptionState();
      break;
    case WorkerMessengerCommand.AMP_SUBSCRIBE:
      onMessageReceivedSubscribe();
      break;
    case WorkerMessengerCommand.AMP_UNSUBSCRIBE:
      onMessageReceivedUnsubscribe();
      break;
  }
});

/**
    Subscribes the visitor to push.
  
    The broadcast value is null (not used in the AMP page).
   */
function onMessageReceivedSubscribe() {
  /*
          If you're integrating amp-web-push with an existing service worker, use your
          existing subscription code. The subscribe() call below is only present to
          demonstrate its proper location. The 'fake-demo-key' value will not work.
      
          If you're setting up your own service worker, you'll need to:
            - Generate a VAPID key (see:
              https://developers.google.com/web/updates/2016/07/web-push-interop-wins)
            - Using urlBase64ToUint8Array() from
              https://github.com/web-push-libs/web-push, convert the VAPID key to a
              UInt8 array and supply it to applicationServerKey
         */
  self.registration.pushManager
    .subscribe({
      userVisibleOnly: true,
      applicationServerKey:
        "BIFZcMeaF6gVZl0GXbWK8Bn3D-_1b7wFyjTaMrrJ-8DtxX7wcJ3aDYv6mDeJkro4TGix7DZmp2jAGCabOerFBBc",
    })
    .then(() => {
      // IMPLEMENT: Forward the push subscription to your server here
      broadcastReply(WorkerMessengerCommand.AMP_SUBSCRIBE, null);
    });
}

/**
        Unsubscribes the subscriber from push.
      
        The broadcast value is null (not used in the AMP page).
       */
function onMessageReceivedUnsubscribe() {
  self.registration.pushManager
    .getSubscription()
    .then((subscription) => subscription.unsubscribe())
    .then(() => {
      // OPTIONALLY IMPLEMENT: Forward the unsubscription to your server here
      broadcastReply(WorkerMessengerCommand.AMP_UNSUBSCRIBE, null);
    });
}

/**
 * Sends a postMessage() to all window frames the service worker controls.
 * @param {string} command
 * @param {!JsonObject} payload
 */
function broadcastReply(command, payload) {
  self.clients.matchAll().then((clients) => {
    for (let i = 0; i < clients.length; i++) {
      const client = clients[i];
      client./*OK*/ postMessage({
        command,
        payload,
      });
    }
  });
}

self.addEventListener("push", (event) => {
  if (!(self.Notification && self.Notification.permission === "granted")) {
    return;
  }

  if (event.data) {
    const notification = event.data.json();

    let options = {
      body: notification.description ?? null,
      icon: notification.icon ?? null,
      image: notification.image ?? null,
      silent: notification.is_silent ?? null,
      requireInteraction: !(notification.is_auto_hide ?? null),
      data: {
        notification_url: notification.url ?? null,
        button_url_1: notification.button_url_1 ?? null,
        button_url_2: notification.button_url_2 ?? null,
        campaign_id: notification.campaign_id ?? null,
        flow_id: notification.flow_id ?? null,
        personal_notification_id: notification.personal_notification_id ?? null,
        source_type: notification.source_type,
        subscriber_id: notification.subscriber_id,
      },
    };

    let actions = [];

    /* Button one */
    if (notification.button_title_1 && notification.button_url_1) {
      actions.push({
        action: "button_click_1",
        title: notification.button_title_1,
      });
    }

    /* Button two */
    if (notification.button_title_2 && notification.button_url_2) {
      actions.push({
        action: "button_click_2",
        title: notification.button_title_2,
      });
    }

    /* Add the actions / buttons */
    options["actions"] = actions;

    /* Display the notification */
    event.waitUntil(
      self.registration.showNotification(notification.title, options)
    );

    /* Send statistics logs */
    event.waitUntil(
      send_tracking_data({
        type: "displayed_notification",
        subscriber_id: notification.subscriber_id,
        [notification.source_type]: notification[notification.source_type],
      })
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  let url = null;

  if (event.action.startsWith("button_click")) {
    if (event.action == "button_click_1")
      url = event.notification.data.button_url_1;
    if (event.action == "button_click_2")
      url = event.notification.data.button_url_2;
  } else {
    if (event.notification.data.notification_url) {
      url = event.notification.data.notification_url;
    }
  }

  /* Open URL if needed */
  if (url) {
    /* Send statistics logs */
    event.waitUntil(
      send_tracking_data({
        type: "clicked_notification",
        subscriber_id: event.notification.data.subscriber_id,
        [event.notification.data.source_type]:
          event.notification.data[event.notification.data.source_type],
      })
    );

    event.waitUntil(clients.openWindow(url));
  }
});

self.addEventListener("notificationclose", (event) => {
  /* Send statistics logs */
  event.waitUntil(
    send_tracking_data({
      type: "closed_notification",
      subscriber_id: event.notification.data.subscriber_id,
      [event.notification.data.source_type]:
        event.notification.data[event.notification.data.source_type],
    })
  );
});

/* Helper to easily send logs */
let send_tracking_data = async (data) => {
  try {
    let response = await fetch(`${url}pixel-track/${website_pixel_key}`, {
      method: "post",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.log(`${title} (${url}): ${error}`);
  }
};
