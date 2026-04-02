class DeliveryTime extends HTMLElement {
    constructor() {
        super();

        this.formatString = this.getAttribute("data-frm-day");
        this.excludedDaysFrom = this.getAttribute("data-exclude-day-from");
        this.excludedDays = this.getAttribute("data-exclude-day").replace(/ /g, '').split(",");
        this.numbDateStart = this.getAttribute("data-estimate-start");
        this.numbDateEnd = this.getAttribute("data-estimate-end");
        this.targetTime = this.getAttribute("data-time");
        this.targetTimeFm = this.targetTime.replace(/ /g, '').replace(/:/g, '');
        this.hr = this.querySelector('.productView-dlvr__remaining-hr');
        this.mins = this.querySelector('.productView-dlvr__remaining-mins');
        this.nowT = new Date();

        const hours = this.nowT.getHours().toString().padStart(2, '0');
        const minutes = this.nowT.getMinutes().toString().padStart(2, '0');
        const seconds = this.nowT.getSeconds().toString().padStart(2, '0');
        const formattedTime = hours + minutes + seconds;


        this.checkExclude = this.checkAllExcludeDays(this.excludedDays)

        if (this.checkExclude) return;

        this.productDeliveryTime();

        const countdown = this.countdownToTime(this.targetTime);
        this.hr.innerHTML = countdown.hours
        this.mins.innerHTML = countdown.minutes
        this.style.display = "block";

        setInterval(() => {
            const countdown = this.countdownToTime(this.targetTime);
            this.hr.innerHTML = countdown.hours
            this.mins.innerHTML = countdown.minutes
        }, 1000);

    }

    // Check if all days of the week are excluded
    checkAllExcludeDays(excludedDays) {
        const now = new Date();
        const deliveryDateTime = new Date(now);

        for (let day of excludedDays) {
            const dayIndex = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].indexOf(day);
            if (deliveryDateTime.getDay() === dayIndex) return true;
        }

        return false;
    }

    productDeliveryTime() {
        const $orderDlvr = $("[data-delivery-time]");
        if ($orderDlvr.length == 0) return;

        let startDay = this.excludeDays(this.excludedDays, this.numbDateStart);
        let endDay = this.excludeDays(this.excludedDays, this.numbDateEnd);

        if (!(startDay instanceof Date)) {
            startDay = new Date(startDay);
        }

        if (!(endDay instanceof Date)) {
            endDay = new Date(endDay);
        }
        
        const hours = this.nowT.getHours().toString().padStart(2, '0');
        const minutes = this.nowT.getMinutes().toString().padStart(2, '0');
        const seconds = this.nowT.getSeconds().toString().padStart(2, '0');
        const formattedTime = hours + minutes + seconds;

        // Check if current time is greater than or equal to setup time then +1 day
        if (parseInt(formattedTime) >= parseInt(this.targetTimeFm)) {
            startDay.setDate(startDay.getDate() + 1);
            endDay.setDate(endDay.getDate() + 1);
        }

        const formattedStartDate = this.formatDate(startDay, this.formatString);
        const formattedEndDate = this.formatDate(endDay, this.formatString);

        $orderDlvr.find('[data-start-delivery]').html(formattedStartDate);
        $orderDlvr.find('[data-end-delivery]').html(formattedEndDate);
    }


    // Format dayOfWeek/dayOfMonth/month/year/year theo value
    formatDate(dateString, formatString) {
        const date = new Date(dateString);

        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }),
            dayOfMonth = date.toLocaleDateString('en-US', { day: '2-digit' }),
            month = date.toLocaleDateString('en-US', { month: 'short' }),
            monthNumber = (date.getMonth() + 1).toString().padStart(2, '0'),
            year = date.toLocaleDateString('en-US', { year: 'numeric' });

        const formattedDate = formatString
            .replace('d', dayOfWeek)
            .replace('DD', dayOfMonth)
            .replace('MMM', month)
            .replace('MM', monthNumber)
            .replace('YYYY', year);

        return formattedDate;
    }


    // If the delivery date is the same as the exclusion date, move to the next day
    excludeDays(excludedDays, dataRange) {
        const now = new Date(),
            deliveryDateTime = new Date(now);


       if(this.excludedDaysFrom == 'only_delivery') {
            deliveryDateTime.setDate(deliveryDateTime.getDate() + parseInt(dataRange));
            excludedDays.forEach(day => {
                const dayIndex = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].indexOf(day);
                if (deliveryDateTime.getDay() === dayIndex) {
                    // Ngày giao hàng sang ngày tiếp theo nếu trùng với ngày loại trừ
                    deliveryDateTime.setDate(deliveryDateTime.getDate() + 1);
                }
            });
       } else {
            let daysToAdd = parseInt(dataRange);
            while (daysToAdd > 0) {
                deliveryDateTime.setDate(deliveryDateTime.getDate() + 1);
                if (!this.isExcludedDayOfWeek(deliveryDateTime, excludedDays)) {
                    daysToAdd--;
                }
            }
       }

        return deliveryDateTime.toLocaleDateString('en-US');
    }

    // Check if the delivery date falls on an excluded day of the week
    isExcludedDayOfWeek(date, excludedDays) {
        const dayIndex = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        return excludedDays.includes(['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][dayIndex]);
    }

    // count with target time
    countdownToTime(targetTime) {
        const currentTime = new Date(),
            targetTimeString = `${currentTime.toDateString()} ${targetTime}`,
            targetDateTime = new Date(targetTimeString);

        // If the timestamp is past the current date, move it to the next date
        if (targetDateTime < currentTime) targetDateTime.setDate(targetDateTime.getDate() + 1);

        // Time remaining between current time and specified time
        const remainingTime = targetDateTime - currentTime;

        const hours = Math.floor(remainingTime / (1000 * 60 * 60)),
            minutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));

        return { hours, minutes };
    }
}
customElements.define('delivery-time', DeliveryTime);